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
		.filter(|player| player.observe == s2protocol::common::OBSERVE_NONE)
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

	let winner = players
		.iter()
		.filter(|player| player.result.as_deref() == Some("Win"))
		.map(|player| player.name.clone())
		.collect();

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
