// Generates the StrainInspector icons - a white magnifying glass with a light-green
// lens on a brand-green rounded square - as PNGs, with no image tooling. Run after
// changing the design:
//   node tools/make-icons.mjs
import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";

const SIZES = [16, 32, 48, 128];
const SUPERSAMPLE = 4;

// Matches the preview/promo art: brand green tile, white glass, light-green lens.
const TILE = [31, 122, 77];    // #1F7A4D
const GLASS = [255, 255, 255]; // white ring + handle
const LENS = [143, 227, 180];  // #8FE3B4 inner glass

const OUT_DIR = new URL("../icons/", import.meta.url);

// Renders one icon at `size`, supersampled and box-downsampled for smooth edges.
function render(size)
{
	const n = size * SUPERSAMPLE;
	const hi = new Uint8ClampedArray(n * n * 4);

	const radius = n * 0.22;             // rounded-square corner radius
	const cx = n * 0.43, cy = n * 0.43;  // lens centre, set high-left to leave room for the handle
	const ringOuter = n * 0.27;
	const ringInner = n * 0.16;          // ring thickness ~0.11n
	const lensDot = n * 0.11;            // inner glass
	const handleHalf = n * 0.06;         // handle half-width
	// Handle runs from the ring's lower-right edge out towards the corner.
	const hx0 = cx + ringOuter * Math.SQRT1_2;
	const hy0 = cy + ringOuter * Math.SQRT1_2;
	const hx1 = n * 0.76, hy1 = n * 0.76;

	for (let y = 0; y < n; y += 1)
	{
		for (let x = 0; x < n; x += 1)
		{
			const i = (y * n + x) * 4;
			const px = x + 0.5, py = y + 0.5;

			if (!roundedRectContains(px, py, n, radius))
			{
				hi[i + 3] = 0;
				continue;
			}

			const dist = Math.hypot(px - cx, py - cy);
			const onRing = dist <= ringOuter && dist >= ringInner;
			const onHandle = distanceToSegment(px, py, hx0, hy0, hx1, hy1) <= handleHalf;

			const colour = onRing || onHandle ? GLASS : (dist <= lensDot ? LENS : TILE);

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

// Shortest distance from point (px,py) to the segment (ax,ay)-(bx,by).
function distanceToSegment(px, py, ax, ay, bx, by)
{
	const dx = bx - ax, dy = by - ay;
	const len2 = dx * dx + dy * dy;
	const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
	return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
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
