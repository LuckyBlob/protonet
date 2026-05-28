import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import Database from 'better-sqlite3'

let db: Database.Database

beforeAll(() => {
  db = new Database(':memory:')
  db.exec('CREATE TABLE test_table (id INTEGER PRIMARY KEY, name TEXT)')
})

afterAll(() => {
  db.close()
})

describe('database', () => {
  it('inserts and retrieves a row', () => {
    db.prepare('INSERT INTO test_table (name) VALUES (?)').run('hello')
    const row = db.prepare('SELECT * FROM test_table WHERE name = ?').get('hello') as { id: number, name: string }
    expect(row.name).toBe('hello')
  })
})
