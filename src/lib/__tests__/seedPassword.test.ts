import { describe, it, expect, vi, afterEach } from "vitest";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { resolveSeedPassword } from "@/lib/seedPassword";

// T-013 batch 11 (tugas U): password seed tidak literal; acak -> ditulis ke file akun, tidak ke konsol.
const tmpFile = () => path.join(mkdtempSync(path.join(tmpdir(), "seedpw-")), ".akun-lokal.txt");

describe("resolveSeedPassword", () => {
  afterEach(() => vi.restoreAllMocks());

  it("pakai SEED_OWNER_PASSWORD kalau diisi, file tidak disentuh", () => {
    const f = tmpFile();
    const r = resolveSeedPassword({ env: { SEED_OWNER_PASSWORD: "dari-env" }, accountFile: f });
    expect(r).toEqual({ password: "dari-env", source: "env" });
    expect(() => readFileSync(f)).toThrow();
  });

  it("env kosong -> password acak, DITAMBAHKAN ke file (isi lama tetap), tidak dicetak ke konsol", () => {
    const f = tmpFile();
    writeFileSync(f, "baris-lama=tetap");
    const spies = (["log", "info", "warn", "error"] as const).map((m) => vi.spyOn(console, m).mockImplementation(() => {}));
    const r = resolveSeedPassword({ env: {}, accountFile: f, generate: () => "acak-uji-123" });
    expect(r).toEqual({ password: "acak-uji-123", source: "generated" });
    const isi = readFileSync(f, "utf8");
    expect(isi.startsWith("baris-lama=tetap\n")).toBe(true);
    expect(isi).toContain("seed_password=acak-uji-123");
    for (const s of spies) expect(s).not.toHaveBeenCalled();
  });

  it("seed ulang memakai seed_password yang sudah tersimpan (tidak membuat baru)", () => {
    const f = tmpFile();
    resolveSeedPassword({ env: {}, accountFile: f, generate: () => "pertama" });
    const r = resolveSeedPassword({ env: {}, accountFile: f, generate: () => "kedua" });
    expect(r).toEqual({ password: "pertama", source: "file" });
    expect(readFileSync(f, "utf8").match(/seed_password=/g)).toHaveLength(1);
  });

  it("password acak bawaan cukup panjang dan berbeda tiap kali", () => {
    const a = resolveSeedPassword({ env: {}, accountFile: tmpFile() }).password;
    const b = resolveSeedPassword({ env: {}, accountFile: tmpFile() }).password;
    expect(a.length).toBeGreaterThanOrEqual(20);
    expect(a).not.toBe(b);
  });
});
