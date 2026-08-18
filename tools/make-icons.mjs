// Generates the StrainInspector icons - a green rating star inside a lens ring on a dark
// rounded square - as PNGs, with no image tooling. Run after changing the design:
//   node tools/make-icons.mjs
import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";

const SIZES = [16, 32, 48, 128];
const SUPERSAMPLE = 4;

// Matches the badge palette (badge.css): dark ground, high-tier green.
const BG = [15, 31, 22];        // #0f1f16
const GREEN = [74, 222, 128];   // #4ade80

const OUT_DIR = new URL("../icons/", import.meta.url);

// Renders one icon at `size`, supersampled and box-downsampled for smooth edges.
function render(size)
{
	const n = size * SUPERSAMPLE;
	const hi = new Uint8ClampedArray(n * n * 4);

	const radius = n * 0.22;
	const centre = n / 2;
	const ringOuter = n * 0.40;
	const ringInner = n * 0.32;
	const star = starPolygon(centre, centre, n * 0.24, n * 0.10, 5, -Math.PI / 2);

	for (let y = 0; y < n; y += 1)
	{
		for (let x = 0; x < n; x += 1)
		{
			const i = (y * n + x) * 4;

			if (!roundedRectContains(x + 0.5, y + 0.5, n, radius))
			{
				hi[i + 3] = 0;
				continue;
			}

			const dist = Math.hypot(x + 0.5 - centre, y + 0.5 - centre);
			const onRing = dist <= ringOuter && dist >= ringInner;
			const inStar = pointInPolygon(x + 0.5, y + 0.5, star);

			const colour = onRing || inStar ? GREEN : BG;

			hi[i] = colour[0];
			hi[i + 1] = colour[1];
			hi[i + 2] = colour[2];
			hi[i + 3] = 255;
		}
	}

	return downsample(hi, n, size);
}

function downsample(hi, n, size)
{
	const out = new Uint8ClampedArray(size * size * 4);
	const block = SUPERSAMPLE * SUPERSAMPLE;

	for (let y = 0; y < size; y += 1)
	{
		for (let x = 0; x < size; x += 1)
		{
			let r = 0, g = 0, b = 0, a = 0;

			for (let dy = 0; dy < SUPERSAMPLE; dy += 1)
			{
				for (let dx = 0; dx < SUPERSAMPLE; dx += 1)
				{
					const i = ((y * SUPERSAMPLE + dy) * n + (x * SUPERSAMPLE + dx)) * 4;
					r += hi[i]; g += hi[i + 1]; b += hi[i + 2]; a += hi[i + 3];
				}
			}

			const o = (y * size + x) * 4;
			out[o] = r / block; out[o + 1] = g / block; out[o + 2] = b / block; out[o + 3] = a / block;
		}
	}

	return out;
}

function roundedRectContains(x, y, size, radius)
{
	const nx = Math.min(x, size - x);
	const ny = Math.min(y, size - y);

	if (nx >= radius || ny >= radius) return nx >= 0 && ny >= 0;

	return Math.hypot(radius - nx, radius - ny) <= radius;
}

function starPolygon(cx, cy, outer, inner, points, rotation)
{
	const vertices = [];

	for (let i = 0; i < points * 2; i += 1)
	{
		const radius = i % 2 === 0 ? outer : inner;
		const angle = rotation + (i * Math.PI) / points;
		vertices.push([cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius]);
	}

	return vertices;
}

function pointInPolygon(x, y, polygon)
{
	let inside = false;

	for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1)
	{
		const [xi, yi] = polygon[i];
		const [xj, yj] = polygon[j];

		if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
	}

	return inside;
}

// Minimal PNG encoder: 8-bit RGBA, one zlib IDAT.
function encodePng(rgba, width, height)
{
	const raw = Buffer.alloc(height * (width * 4 + 1));

	for (let y = 0; y < height; y += 1)
	{
		raw[y * (width * 4 + 1)] = 0; // no filter
		rgba.slice(y * width * 4, (y + 1) * width * 4).forEach((byte, x) => { raw[y * (width * 4 + 1) + 1 + x] = byte; });
	}

	const ihdr = Buffer.alloc(13);
	ihdr.writeUInt32BE(width, 0);
	ihdr.writeUInt32BE(height, 4);
	ihdr[8] = 8; ihdr[9] = 6; // 8-bit, RGBA

	return Buffer.concat([
		Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
		chunk("IHDR", ihdr),
		chunk("IDAT", deflateSync(raw)),
		chunk("IEND", Buffer.alloc(0))
	]);
}

function chunk(type, data)
{
	const typeBytes = Buffer.from(type, "ascii");
	const body = Buffer.concat([typeBytes, data]);
	const length = Buffer.alloc(4);
	length.writeUInt32BE(data.length, 0);

	const crc = Buffer.alloc(4);
	crc.writeUInt32BE(crc32(body) >>> 0, 0);

	return Buffer.concat([length, body, crc]);
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

	return c ^ 0xffffffff;
}

mkdirSync(OUT_DIR, { recursive: true });

for (const size of SIZES)
{
	writeFileSync(new URL(`icon-${size}.png`, OUT_DIR), encodePng(render(size), size, size));
	console.log(`wrote icons/icon-${size}.png`);
}
