// Builds the Chrome Web Store upload - dist/strain-inspector-<version>.zip - containing
// only the files the extension needs at runtime. Tests, tools, docs and
// node_modules are left out. No dependencies; writes the zip by hand.
//   npm run package
import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { deflateRawSync } from "node:zlib";

const ROOT = new URL("../", import.meta.url);

// The runtime set: the manifest, the icons, everything under src (including the
// bundled data), and the licence. Nothing else ships.
const INCLUDE = ["manifest.json", "LICENSE", "icons", "src"];

// Collects a path (file or directory) into { name, data } records with
// forward-slash names relative to the project root.
function collect(relativePath)
{
	const absolute = new URL(relativePath, ROOT);
	const stats = statSync(absolute);

	if (stats.isDirectory())
	{
		return readdirSync(absolute).flatMap((child) => collect(`${relativePath}/${child}`));
	}

	return [{ name: relativePath, data: readFileSync(absolute) }];
}

function buildZip(files)
{
	const locals = [];
	const centrals = [];
	let offset = 0;

	for (const { name, data } of files)
	{
		const nameBytes = Buffer.from(name, "utf8");
		const compressed = deflateRawSync(data);
		const crc = crc32(data);

		const local = Buffer.alloc(30 + nameBytes.length);
		local.writeUInt32LE(0x04034b50, 0);
		local.writeUInt16LE(20, 4);          // version needed
		local.writeUInt16LE(0, 6);           // flags
		local.writeUInt16LE(8, 8);           // method: deflate
		local.writeUInt32LE(0, 10);          // fixed mod time/date (reproducible)
		local.writeUInt32LE(crc, 14);
		local.writeUInt32LE(compressed.length, 18);
		local.writeUInt32LE(data.length, 22);
		local.writeUInt16LE(nameBytes.length, 26);
		local.writeUInt16LE(0, 28);          // extra length
		nameBytes.copy(local, 30);

		locals.push(local, compressed);

		const central = Buffer.alloc(46 + nameBytes.length);
		central.writeUInt32LE(0x02014b50, 0);
		central.writeUInt16LE(20, 4);        // version made by
		central.writeUInt16LE(20, 6);        // version needed
		central.writeUInt16LE(0, 8);
		central.writeUInt16LE(8, 10);
		central.writeUInt32LE(0, 12);
		central.writeUInt32LE(crc, 16);
		central.writeUInt32LE(compressed.length, 20);
		central.writeUInt32LE(data.length, 24);
		central.writeUInt16LE(nameBytes.length, 28);
		central.writeUInt32LE(offset, 42);   // local header offset
		nameBytes.copy(central, 46);

		centrals.push(central);
		offset += local.length + compressed.length;
	}

	const centralBytes = Buffer.concat(centrals);
	const end = Buffer.alloc(22);
	end.writeUInt32LE(0x06054b50, 0);
	end.writeUInt16LE(files.length, 8);
	end.writeUInt16LE(files.length, 10);
	end.writeUInt32LE(centralBytes.length, 12);
	end.writeUInt32LE(offset, 16);

	return Buffer.concat([...locals, centralBytes, end]);
}

const CRC_TABLE = (() =>
{
	const table = new Uint32Array(256);

	for (let n = 0; n < 256; n += 1)
	{
		let c = n;
		for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
		table[n] = c;
	}

	return table;
})();

function crc32(buffer)
{
	let c = 0xffffffff;

	for (const byte of buffer) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);

	return (c ^ 0xffffffff) >>> 0;
}

const version = JSON.parse(readFileSync(new URL("manifest.json", ROOT), "utf8")).version;
const files = INCLUDE.flatMap((entry) => collect(entry));
const zip = buildZip(files);

mkdirSync(new URL("dist/", ROOT), { recursive: true });
writeFileSync(new URL(`dist/strain-inspector-${version}.zip`, ROOT), zip);

console.log(`wrote dist/strain-inspector-${version}.zip - ${files.length} files, ${zip.length} bytes`);
