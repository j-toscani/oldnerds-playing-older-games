use s2protocol::{convert_tracker_loop_to_seconds, read_details, read_protocol_header, read_tracker_events};
use serde::Serialize;
use sha2::{Digest, Sha256};
use wasm_bindgen::prelude::*;

/// Every StarCraft II replay file starts with this signature. `read_details`
/// asserts on it internally and panics on a mismatch instead of returning an
/// error, so callers must check it themselves before touching the parser.
const REPLAY_SIGNATURE: &[u8] = b"StarCraft II replay\x1b11";

const PARSER_VERSION: &str = env!("CARGO_PKG_VERSION");

#[derive(Serialize, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ParsedPlayer {
	pub name: String,
	pub toon_handle: String,
	pub race: String,
	pub team: u8,
	pub control: String,
	pub result: Option<String>,
}

#[derive(Serialize, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ParsedReplay {
	pub content_hash: String,
	pub parser_version: String,
	pub played_at: String,
	pub map: String,
	pub duration_seconds: u32,
	pub game_version: String,
	pub players: Vec<ParsedPlayer>,
	pub winner: Vec<String>,
}

fn unescape_player_name(raw: &str) -> String {
	raw.replace("<sp/>", " ")
		.replace("&lt;", "<")
		.replace("&gt;", ">")
		.replace("&quot;", "\"")
		.replace("&apos;", "'")
		.replace("&amp;", "&")
}

/// Spectators and referees appear in `player_list` like anyone else and are
/// told apart only by `observe`. Upstream's `get_player_names` filters them the
/// same way; leaving them in would list them as players and let them skew the
/// name-based winner derivation.
fn is_active_player(observe: u8) -> bool {
	observe == s2protocol::common::OBSERVE_NONE
}

fn winners_of(players: &[ParsedPlayer]) -> Vec<String> {
	players
		.iter()
		.filter(|player| player.result.as_deref() == Some("Win"))
		.map(|player| player.name.clone())
		.collect()
}

fn control_label(control: u8) -> String {
	match control {
		2 => "human".to_string(),
		3 => "ai".to_string(),
		_ => "unknown".to_string(),
	}
}

/// `time_utc`/`time_local_offset` are Windows FILETIME values (100ns ticks
/// since 1601-01-01) in local time with the offset baked in; converting to
/// UTC seconds-since-epoch needs both. Verified against real ONOG replays
/// during the #58 spike (see docs/features/replay-library-local.md).
fn played_at_from_filetime(time_utc: i64, time_local_offset: i64) -> Result<String, String> {
	const FILETIME_EPOCH_DIFF_MICROS: i64 = 11_644_473_600_000_000;
	let micros = time_utc / 10 - FILETIME_EPOCH_DIFF_MICROS - time_local_offset / 10;
	let secs = micros.div_euclid(1_000_000);
	let nanos = (micros.rem_euclid(1_000_000) * 1_000) as u32;
	chrono::DateTime::from_timestamp(secs, nanos)
		.map(|dt: chrono::DateTime<chrono::Utc>| dt.to_rfc3339_opts(chrono::SecondsFormat::Secs, true))
		.ok_or_else(|| "replay has an invalid playedAt timestamp".to_string())
}

fn has_replay_signature(bytes: &[u8]) -> bool {
	bytes.len() >= REPLAY_SIGNATURE.len()
		&& bytes[..64.min(bytes.len())]
			.windows(REPLAY_SIGNATURE.len())
			.any(|window| window == REPLAY_SIGNATURE)
}

/// `nom_mpq::parser::parse` slices the input at the offsets the archive header
/// declares without bounds-checking them (`&orig_input[hash_table_offset..]`),
/// so a truncated file panics instead of erroring. Under `panic = "abort"` that
/// aborts the whole WASM instance, not just this call — hence we validate the
/// declared table offsets against the actual length ourselves first.
fn check_mpq_tables_are_in_bounds(bytes: &[u8]) -> Result<(), String> {
	let (_, (header, _)) =
		nom_mpq::parser::read_headers(bytes).map_err(|err| format!("failed to read MPQ header: {err:?}"))?;

	let table_end = |offset: u32, entries: u32| -> Option<usize> {
		(offset as usize)
			.checked_add(header.offset)?
			.checked_add(16usize.checked_mul(entries as usize)?)
	};

	let hash_table_end = table_end(header.hash_table_offset, header.hash_table_entries);
	let block_table_end = table_end(header.block_table_offset, header.block_table_entries);

	match (hash_table_end, block_table_end) {
		(Some(hash_end), Some(block_end)) if hash_end <= bytes.len() && block_end <= bytes.len() => Ok(()),
		_ => Err("replay file is truncated or corrupt".to_string()),
	}
}

/// Second bounds guard, after the MPQ itself is parsed. `read_mpq_file_sector`
/// uses two values straight out of the decrypted tables without checking them:
/// `block_table_entries[hash_entry.block_table_index]` and
/// `&orig_input[block_entry.offset + archive_header.offset..]`. A corrupt file
/// can point either anywhere, which panics — and a panic leaks everything that
/// was allocated at that moment, since nothing unwinds under `panic = "abort"`.
fn check_mpq_entries_are_in_bounds(mpq: &nom_mpq::MPQ, bytes: &[u8]) -> Result<(), String> {
	/// Unused hash slots carry these instead of a real index; they are never
	/// dereferenced, so they must not be treated as corruption.
	const HASH_ENTRY_EMPTY: u32 = 0xffff_ffff;
	const HASH_ENTRY_DELETED: u32 = 0xffff_fffe;

	let corrupt = || "replay file is truncated or corrupt".to_string();

	for hash_entry in &mpq.hash_table_entries {
		if matches!(hash_entry.block_table_index, HASH_ENTRY_EMPTY | HASH_ENTRY_DELETED) {
			continue;
		}

		let block_entry = mpq
			.block_table_entries
			.get(hash_entry.block_table_index as usize)
			.ok_or_else(corrupt)?;

		let block_end = (block_entry.offset as usize)
			.checked_add(mpq.archive_header.offset)
			.and_then(|start| start.checked_add(block_entry.archived_size as usize))
			.ok_or_else(corrupt)?;

		if block_end > bytes.len() {
			return Err(corrupt());
		}
	}

	Ok(())
}

/// Parses a `.SC2Replay` file's raw bytes into a `ParsedReplay`. The result
/// shape matches `ReplayData` from `@onog/shared` minus the fields owned by
/// the IndexedDB layer (`id`, `importedAt`, `fileName`). Pure Rust so it can
/// run under `cargo test` without a wasm runtime; `parse` below is the thin
/// wasm-bindgen boundary around it.
pub fn parse_replay(bytes: &[u8]) -> Result<ParsedReplay, String> {
	if !has_replay_signature(bytes) {
		return Err("not a StarCraft II replay file".to_string());
	}
	check_mpq_tables_are_in_bounds(bytes)?;

	let content_hash = format!("{:x}", Sha256::digest(bytes));

	let (_, mpq) = s2protocol::parser::parse(bytes).map_err(|err| format!("failed to read MPQ archive: {err:?}"))?;
	check_mpq_entries_are_in_bounds(&mpq, bytes)?;

	let details =
		read_details("replay", &mpq, bytes).map_err(|err| format!("failed to read replay details: {err:?}"))?;
	let tracker_events =
		read_tracker_events("replay", &mpq, bytes).map_err(|err| format!("failed to read tracker events: {err:?}"))?;

	let base_build = read_protocol_header(&mpq)
		.map(|(_, header)| header.m_version.m_base_build)
		.unwrap_or(0);
	let loops: i64 = tracker_events.iter().map(|event| event.delta as i64).sum();
	let duration_seconds = convert_tracker_loop_to_seconds(loops);
	let played_at = played_at_from_filetime(details.time_utc, details.time_local_offset)?;

	let players: Vec<ParsedPlayer> = details
		.player_list
		.iter()
		.filter(|player| is_active_player(player.observe))
		.map(|player| ParsedPlayer {
			name: unescape_player_name(&player.name),
			toon_handle: format!("{}-S2-{}-{}", player.toon.region, player.toon.realm, player.toon.id),
			race: player.race.clone(),
			team: player.team_id,
			control: control_label(player.control),
			result: match player.result.as_str() {
				"Win" | "Loss" => Some(player.result.clone()),
				_ => None,
			},
		})
		.collect();

	let winner = winners_of(&players);

	Ok(ParsedReplay {
		content_hash,
		parser_version: PARSER_VERSION.to_string(),
		played_at,
		map: details.title.clone(),
		duration_seconds,
		game_version: base_build.to_string(),
		players,
		winner,
	})
}

/// wasm-bindgen boundary: converts `ParsedReplay`/errors to `JsValue`.
#[wasm_bindgen]
pub fn parse(bytes: &[u8]) -> Result<JsValue, JsValue> {
	let parsed = parse_replay(bytes).map_err(|err| JsValue::from_str(&err))?;
	serde_wasm_bindgen::to_value(&parsed).map_err(|err| JsValue::from_str(&format!("failed to serialize result: {err}")))
}

#[cfg(test)]
mod tests {
	use super::*;

	#[test]
	fn rejects_bytes_without_the_replay_signature() {
		let err = parse_replay(b"not a replay file at all").unwrap_err();
		assert_eq!(err, "not a StarCraft II replay file");
	}

	#[test]
	fn rejects_truncated_input_instead_of_panicking() {
		let err = parse_replay(b"short").unwrap_err();
		assert_eq!(err, "not a StarCraft II replay file");
	}

	#[test]
	fn has_replay_signature_finds_it_within_the_first_64_bytes() {
		let mut bytes = vec![0u8; 10];
		bytes.extend_from_slice(REPLAY_SIGNATURE);
		assert!(has_replay_signature(&bytes));
	}

	#[test]
	fn has_replay_signature_ignores_a_match_past_byte_64() {
		let mut bytes = vec![0u8; 70];
		bytes.extend_from_slice(REPLAY_SIGNATURE);
		assert!(!has_replay_signature(&bytes));
	}

	#[test]
	fn unescapes_xml_entities_and_the_sp_space_marker() {
		assert_eq!(unescape_player_name("&lt;chezs&gt;<sp/>Sazed"), "<chezs> Sazed");
		assert_eq!(unescape_player_name("Tom &amp; Jerry"), "Tom & Jerry");
		assert_eq!(unescape_player_name("&quot;quoted&quot;"), "\"quoted\"");
	}

	fn player(name: &str, result: Option<&str>) -> ParsedPlayer {
		ParsedPlayer {
			name: name.to_string(),
			toon_handle: "1-S2-1-1".to_string(),
			race: "Zerg".to_string(),
			team: 0,
			control: "human".to_string(),
			result: result.map(str::to_string),
		}
	}

	#[test]
	fn counts_only_non_observing_slots_as_players() {
		assert!(is_active_player(0));
		assert!(!is_active_player(1));
		assert!(!is_active_player(2));
	}

	#[test]
	fn derives_winners_from_player_results() {
		let players = vec![
			player("Winner", Some("Win")),
			player("Loser", Some("Loss")),
			player("Undecided", None),
		];
		assert_eq!(winners_of(&players), vec!["Winner".to_string()]);
	}

	#[test]
	fn reports_no_winner_when_no_result_says_win() {
		let players = vec![player("A", Some("Loss")), player("B", None)];
		assert!(winners_of(&players).is_empty());
	}

	#[test]
	fn reports_every_winner_in_a_team_game() {
		let players = vec![
			player("A", Some("Win")),
			player("B", Some("Win")),
			player("C", Some("Loss")),
		];
		assert_eq!(winners_of(&players), vec!["A".to_string(), "B".to_string()]);
	}

	#[test]
	fn maps_control_codes_to_labels() {
		assert_eq!(control_label(2), "human");
		assert_eq!(control_label(3), "ai");
		assert_eq!(control_label(0), "unknown");
	}

	#[test]
	fn converts_a_known_filetime_pair_to_the_expected_utc_instant() {
		// Independent anchor, not taken from any replay: FILETIME 0 is
		// 1601-01-01, and one full day of 100ns ticks past the Unix epoch
		// boundary must land on 1970-01-02.
		const UNIX_EPOCH_AS_FILETIME: i64 = 116_444_736_000_000_000;
		const ONE_DAY: i64 = 864_000_000_000;
		assert_eq!(played_at_from_filetime(UNIX_EPOCH_AS_FILETIME, 0).unwrap(), "1970-01-01T00:00:00Z");
		assert_eq!(
			played_at_from_filetime(UNIX_EPOCH_AS_FILETIME + ONE_DAY, 0).unwrap(),
			"1970-01-02T00:00:00Z"
		);

		// The local offset is subtracted, so a +2h offset moves the instant back.
		const TWO_HOURS: i64 = 72_000_000_000;
		assert_eq!(
			played_at_from_filetime(UNIX_EPOCH_AS_FILETIME + ONE_DAY, TWO_HOURS).unwrap(),
			"1970-01-01T22:00:00Z"
		);
	}

	#[test]
	fn rejects_a_truncated_replay_instead_of_panicking() {
		// nom-mpq slices at the offsets the header declares without checking
		// them; under panic = "abort" that would abort the WASM instance.
		let bytes = std::fs::read("tests/fixtures/Burrow.SC2Replay").expect("fixture replay must exist");
		for length in [1129usize, 2265, 4537, 9081, 18169, 36345] {
			let err = parse_replay(&bytes[..length]).unwrap_err();
			assert_eq!(err, "replay file is truncated or corrupt", "truncated at {length} bytes");
		}
	}

	#[test]
	fn parses_the_fixture_replay_without_touching_the_external_crates_correctness() {
		// We trust s2protocol to read the file correctly (that's its job, not
		// ours) — this only checks that our own wrapper logic (signature
		// check, error mapping, winner derivation) runs end to end on a real
		// file without panicking or misclassifying the winner.
		let bytes = std::fs::read("tests/fixtures/Burrow.SC2Replay").expect("fixture replay must exist");
		let replay = parse_replay(&bytes).expect("fixture replay must parse");

		assert!(!replay.map.is_empty());
		assert!(!replay.players.is_empty());
		assert_eq!(replay.parser_version, PARSER_VERSION);
		for player in &replay.players {
			let is_winner = replay.winner.contains(&player.name);
			assert_eq!(is_winner, player.result.as_deref() == Some("Win"));
		}
	}
}

#[cfg(test)]
mod corruption_tests {
	use super::*;

	/// Deterministic byte mutations of the fixture. A panic anywhere in the
	/// parser aborts the whole test process, so "this test completes" *is* the
	/// assertion: no input may panic, every one must come back Ok or Err.
	///
	/// Mutating a real archive rather than shipping corrupt fixtures keeps the
	/// repo free of extra binaries and covers far more shapes of corruption.
	#[test]
	fn never_panics_on_corrupted_input() {
		let original = std::fs::read("tests/fixtures/Burrow.SC2Replay").expect("fixture replay must exist");
		let mut seed: u64 = 0x5EED_1234;
		let mut next = move || {
			seed = seed.wrapping_mul(6364136223846793005).wrapping_add(1442695040888963407);
			(seed >> 33) as usize
		};

		let mut parsed = 0usize;
		let mut rejected = 0usize;
		for _ in 0..1000 {
			let mut corrupted = original.clone();
			for _ in 0..3 {
				let index = next() % corrupted.len();
				corrupted[index] = (next() % 256) as u8;
			}
			match parse_replay(&corrupted) {
				Ok(_) => parsed += 1,
				Err(_) => rejected += 1,
			}
		}

		assert_eq!(parsed + rejected, 1000);
	}
}
