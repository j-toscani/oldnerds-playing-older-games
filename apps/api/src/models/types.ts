export interface Model<T extends { id?: string }> {
	schema: string;
	create(data: Omit<T, 'id'>): Promise<T>;
	findById(id: string): Promise<T | null>;
	find(): Promise<T[]>;
	remove(id: string): Promise<void>;
}
