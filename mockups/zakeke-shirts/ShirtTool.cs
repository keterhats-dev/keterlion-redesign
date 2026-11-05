// Tools for the custom-shirt photos (5.11.2026): measure the shirt in the photo, recolour it to black or white,
// and cut sleeve close-ups. Loaded by make-shirts.ps1 with Add-Type.
using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;

public static class ShirtTool
{
    static byte[] Load(string path, out int w, out int h, out int stride)
    {
        using (var src = new Bitmap(path))
        using (var bmp = new Bitmap(src.Width, src.Height, PixelFormat.Format24bppRgb))
        {
            using (var g = Graphics.FromImage(bmp)) { g.Clear(Color.White); g.DrawImage(src, 0, 0, src.Width, src.Height); }
            w = bmp.Width; h = bmp.Height;
            var d = bmp.LockBits(new Rectangle(0, 0, w, h), ImageLockMode.ReadOnly, PixelFormat.Format24bppRgb);
            stride = d.Stride;
            var a = new byte[stride * h];
            Marshal.Copy(d.Scan0, a, 0, a.Length);
            bmp.UnlockBits(d);
            return a;
        }
    }

    static void Save(byte[] a, int w, int h, int stride, string path)
    {
        using (var bmp = new Bitmap(w, h, PixelFormat.Format24bppRgb))
        {
            var d = bmp.LockBits(new Rectangle(0, 0, w, h), ImageLockMode.WriteOnly, PixelFormat.Format24bppRgb);
            Marshal.Copy(a, 0, d.Scan0, a.Length);
            bmp.UnlockBits(d);
            if (path.EndsWith(".png", StringComparison.OrdinalIgnoreCase)) bmp.Save(path, ImageFormat.Png);
            else SaveJpeg(bmp, path, 92L);
        }
    }

    static void SaveJpeg(Bitmap bmp, string path, long q)
    {
        ImageCodecInfo enc = null;
        foreach (var c in ImageCodecInfo.GetImageEncoders()) if (c.MimeType == "image/jpeg") enc = c;
        var p = new EncoderParameters(1);
        p.Param[0] = new EncoderParameter(System.Drawing.Imaging.Encoder.Quality, q);
        bmp.Save(path, enc, p);
    }

    static double Lum(byte[] a, int i) { return 0.299 * a[i + 2] + 0.587 * a[i + 1] + 0.114 * a[i]; }

    // background = near-white pixels connected to the border
    static bool[] Background(byte[] a, int w, int h, int stride, int thr)
    {
        var bg = new bool[w * h];
        var q = new Queue<int>();
        Func<int, bool> white = k => { int i = (k / w) * stride + (k % w) * 3; return a[i] >= thr && a[i + 1] >= thr && a[i + 2] >= thr; };
        for (int x = 0; x < w; x++) { foreach (int k in new[] { x, (h - 1) * w + x }) if (!bg[k] && white(k)) { bg[k] = true; q.Enqueue(k); } }
        for (int y = 0; y < h; y++) { foreach (int k in new[] { y * w, y * w + w - 1 }) if (!bg[k] && white(k)) { bg[k] = true; q.Enqueue(k); } }
        while (q.Count > 0)
        {
            int k = q.Dequeue(), x = k % w, y = k / w;
            int[] nb = { x > 0 ? k - 1 : -1, x < w - 1 ? k + 1 : -1, y > 0 ? k - w : -1, y < h - 1 ? k + w : -1 };
            foreach (int n in nb) if (n >= 0 && !bg[n] && white(n)) { bg[n] = true; q.Enqueue(n); }
        }
        return bg;
    }

    // distance (in px, up to max) from each shirt pixel to the background
    static int[] EdgeDist(bool[] bg, int w, int h, int max)
    {
        var dist = new int[w * h];
        for (int k = 0; k < w * h; k++) dist[k] = bg[k] ? 0 : max;
        for (int pass = 1; pass < max; pass++)
            for (int y = 1; y < h - 1; y++)
                for (int x = 1; x < w - 1; x++)
                {
                    int k = y * w + x;
                    if (dist[k] <= pass) continue;
                    if (dist[k - 1] == pass - 1 || dist[k + 1] == pass - 1 || dist[k - w] == pass - 1 || dist[k + w] == pass - 1) dist[k] = pass;
                }
        return dist;
    }

    public static string Box(string path)
    {
        int w, h, s; var a = Load(path, out w, out h, out s);
        var bg = Background(a, w, h, s, 232);
        int x0 = w, y0 = h, x1 = -1, y1 = -1; var lums = new List<double>();
        for (int y = 0; y < h; y++) for (int x = 0; x < w; x++)
            {
                if (bg[y * w + x]) continue;
                if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
                if ((x + y) % 7 == 0) lums.Add(Lum(a, y * s + x * 3));
            }
        lums.Sort();
        return string.Format("x {0}-{1} (w {2})  y {3}-{4} (h {5})  lum p10 {6:0} med {7:0} p90 {8:0}", x0, x1, x1 - x0, y0, y1, y1 - y0,
            lums[lums.Count / 10], lums[lums.Count / 2], lums[lums.Count * 9 / 10]);
    }

    // mode "black" or "white": keeps the folds and shading of the source shirt, the background stays pure white,
    // and the light label inside the collar keeps its own colour
    public static string Recolor(string path, string outPath, string mode, double baseV, double gain)
    {
        int w, h, s; var a = Load(path, out w, out h, out s);
        var bg = Background(a, w, h, s, 232);
        var dist = EdgeDist(bg, w, h, 4);
        var lums = new List<double>();
        for (int k = 0; k < w * h; k += 5) if (!bg[k] && dist[k] >= 4) lums.Add(Lum(a, (k / w) * s + (k % w) * 3));
        lums.Sort();
        double med = lums[lums.Count / 2];
        bool black = mode == "black";

        double tagFrom = med + 55, tagTo = med + 95;   // lighter than this inside the shirt = the label
        var o = (byte[])a.Clone();
        for (int y = 0; y < h; y++) for (int x = 0; x < w; x++)
            {
                int k = y * w + x; if (bg[k]) continue;
                int i = y * s + x * 3;
                double L = Lum(a, i), v;
                if (dist[k] < 4)
                {
                    // edge pixel: part shirt, part white background
                    double al = Math.Max(0, Math.Min(1, (255 - L) / (255 - med)));
                    double core = baseV;
                    v = al * core + (1 - al) * 255;
                    o[i] = o[i + 1] = o[i + 2] = (byte)Math.Max(0, Math.Min(255, v));
                    continue;
                }
                v = baseV + (L - med) * gain;
                v = Math.Max(black ? 8 : 150, Math.Min(black ? 90 : 252, v));
                double wt = Math.Max(0, Math.Min(1, (tagTo - L) / (tagTo - tagFrom)));
                for (int c = 0; c < 3; c++) o[i + c] = (byte)Math.Max(0, Math.Min(255, a[i + c] + (v - a[i + c]) * wt));
            }
        Save(o, w, h, s, outPath);
        return string.Format("{0}: median {1:0}", outPath, med);
    }

    // ---- washed shirts (5.11.2026): the supplier sent the washed colours only as small WhatsApp collages,
    // so the shape, folds and seams come from a sharp studio photo, and the colour and wash come from the collage.

    // the shirts in a collage: "x,y,w,h" for each, top to bottom, right to left inside a row is NOT assumed (sorted left to right)
    public static string Components(string path)
    {
        int w, h, s; var a = Load(path, out w, out h, out s);
        var bg = Background(a, w, h, s, 228);
        var seen = new bool[w * h]; var boxes = new List<int[]>();
        var q = new Queue<int>();
        for (int k0 = 0; k0 < w * h; k0++)
        {
            if (bg[k0] || seen[k0]) continue;
            int x0 = w, y0 = h, x1 = 0, y1 = 0, area = 0;
            seen[k0] = true; q.Enqueue(k0);
            while (q.Count > 0)
            {
                int k = q.Dequeue(), x = k % w, y = k / w; area++;
                if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
                int[] nb = { x > 0 ? k - 1 : -1, x < w - 1 ? k + 1 : -1, y > 0 ? k - w : -1, y < h - 1 ? k + w : -1 };
                foreach (int n in nb) if (n >= 0 && !bg[n] && !seen[n]) { seen[n] = true; q.Enqueue(n); }
            }
            if (area > 20000) boxes.Add(new[] { x0, y0, x1 - x0 + 1, y1 - y0 + 1 });
        }
        boxes.Sort((p, r) => Math.Abs((p[1] + p[3] / 2) - (r[1] + r[3] / 2)) > 150 ? (p[1] + p[3] / 2).CompareTo(r[1] + r[3] / 2) : p[0].CompareTo(r[0]));
        var parts = new List<string>();
        foreach (var b in boxes) parts.Add(string.Join(",", b));
        return string.Join(";", parts);
    }

    static double Hash(int x, int y, int seed)
    {
        unchecked
        {
            uint v = (uint)(x * 374761393 + y * 668265263 + seed * 1442695041);
            v = (v ^ (v >> 13)) * 1274126177u; v ^= v >> 16;
            return (v & 0xFFFFFF) / 16777215.0;
        }
    }

    static double Noise(double x, double y, double scale, int seed)
    {
        double fx = x / scale, fy = y / scale;
        int ix = (int)Math.Floor(fx), iy = (int)Math.Floor(fy);
        double tx = fx - ix, ty = fy - iy;
        tx = tx * tx * (3 - 2 * tx); ty = ty * ty * (3 - 2 * ty);
        double p = Hash(ix, iy, seed), b = Hash(ix + 1, iy, seed), c = Hash(ix, iy + 1, seed), d = Hash(ix + 1, iy + 1, seed);
        return p + (b - p) * tx + (c - p) * ty + (p - b - c + d) * tx * ty;
    }

    // shapePath: sharp studio photo (the brown one). refPath + box: one shirt in the collage.
    // The wash pattern is made up (clouds, speckles, lighter along the edges), then every pixel gets the colour
    // found at the same rank in the real washed shirt, so the colours match the collage. The studio folds are laid on top.
    public static string Wash(string shapePath, string refPath, int bx, int by, int bw, int bh, string outPath, int seed, double shadeK)
    {
        int w, h, s; var a = Load(shapePath, out w, out h, out s);
        var bg = Background(a, w, h, s, 232);
        var dist = EdgeDist(bg, w, h, 40);
        var lums = new List<double>();
        for (int k = 0; k < w * h; k += 5) if (!bg[k] && dist[k] >= 4) lums.Add(Lum(a, (k / w) * s + (k % w) * 3));
        lums.Sort();
        double med = lums[lums.Count / 2];

        // the real washed colours, darkest to lightest
        int rw, rh, rs; var ra = Load(refPath, out rw, out rh, out rs);
        var rbg = Background(ra, rw, rh, rs, 228);
        var rdist = EdgeDist(rbg, rw, rh, 4);
        var cols = new List<int[]>();
        for (int y = by; y < by + bh; y++) for (int x = bx; x < bx + bw; x++)
            {
                int k = y * rw + x; if (rbg[k] || rdist[k] < 4) continue;
                int i = y * rs + x * 3;
                cols.Add(new[] { ra[i + 2], ra[i + 1], ra[i], (int)(Lum(ra, i) * 10) });
            }
        cols.Sort((p, r) => p[3].CompareTo(r[3]));
        // drop the darkest and lightest 1% (label, shadow in the collar)
        int lo = cols.Count / 100, hi = cols.Count - cols.Count / 100 - 1;
        var mid = cols[cols.Count / 2];

        // made-up wash pattern for every shirt pixel
        var idx = new List<int>(); var val = new List<double>();
        var rnd = new Random(seed);
        for (int y = 0; y < h; y++) for (int x = 0; x < w; x++)
            {
                int k = y * w + x; if (bg[k] || dist[k] < 4) continue;
                double v = 0.12 * Noise(x, y, 170, seed) + 0.12 * Noise(x, y, 70, seed + 1) + 0.14 * Noise(x, y, 28, seed + 2)
                         + 0.22 * Noise(x, y, 9, seed + 3) + 0.22 * Noise(x, y, 3, seed + 4) + 0.12 * rnd.NextDouble();
                v += 0.22 * Math.Max(0, 1 - dist[k] / 38.0);
                idx.Add(k); val.Add(v);
            }
        var order = new int[idx.Count];
        for (int n = 0; n < order.Length; n++) order[n] = n;
        var keys = val.ToArray();
        Array.Sort(keys, order);

        var o = (byte[])a.Clone();
        Action<int, int[], double> put = (i, c, sh) =>
        {
            for (int ch = 0; ch < 3; ch++) o[i + 2 - ch] = (byte)Math.Max(0, Math.Min(255, c[ch] * sh));
        };
        double tagFrom = med + 55, tagTo = med + 95;
        for (int n = 0; n < order.Length; n++)
        {
            int k = idx[order[n]], i = (k / w) * s + (k % w) * 3;
            var c = cols[lo + (int)((long)n * (hi - lo) / Math.Max(1, order.Length - 1))];
            double L = Lum(a, i);
            double sh = 1 + (L - med) / med * shadeK;
            sh = Math.Max(0.55, Math.Min(1.3, sh));
            double wt = Math.Max(0, Math.Min(1, (tagTo - L) / (tagTo - tagFrom)));
            if (wt >= 1) put(i, c, sh);
            else
            {
                var orig = new[] { (int)a[i + 2], (int)a[i + 1], (int)a[i] };
                for (int ch = 0; ch < 3; ch++) o[i + 2 - ch] = (byte)Math.Max(0, Math.Min(255, orig[ch] + (c[ch] * sh - orig[ch]) * wt));
            }
        }
        // edge pixels: part shirt, part white background
        for (int k = 0; k < w * h; k++)
        {
            if (bg[k] || dist[k] >= 4) continue;
            int i = (k / w) * s + (k % w) * 3;
            double al = Math.Max(0, Math.Min(1, (255 - Lum(a, i)) / (255 - med)));
            var c = cols[lo + (hi - lo) * 3 / 4];
            for (int ch = 0; ch < 3; ch++) o[i + 2 - ch] = (byte)Math.Max(0, Math.Min(255, al * c[ch] + (1 - al) * 255));
        }
        Save(o, w, h, s, outPath);
        return string.Format("{0}: {1} colours from the collage, middle #{2:X2}{3:X2}{4:X2}", outPath, cols.Count, mid[0], mid[1], mid[2]);
    }

    // square crop, scaled to size x size, white outside the photo
    public static void Crop(string path, string outPath, int cx, int cy, int side, int size, bool mirror)
    {
        using (var src = new Bitmap(path))
        using (var bmp = new Bitmap(size, size, PixelFormat.Format24bppRgb))
        using (var g = Graphics.FromImage(bmp))
        {
            g.Clear(Color.White);
            g.InterpolationMode = System.Drawing.Drawing2D.InterpolationMode.HighQualityBicubic;
            g.DrawImage(src, new Rectangle(0, 0, size, size), new Rectangle(cx - side / 2, cy - side / 2, side, side), GraphicsUnit.Pixel);
            if (mirror) bmp.RotateFlip(RotateFlipType.RotateNoneFlipX);
            SaveJpeg(bmp, outPath, 92L);
        }
    }

    // contact sheet with labels
    public static void Sheet(string[] paths, string[] labels, string outPath, int cell, int cols)
    {
        int rows = (paths.Length + cols - 1) / cols;
        using (var bmp = new Bitmap(cell * cols, (cell + 26) * rows, PixelFormat.Format24bppRgb))
        using (var g = Graphics.FromImage(bmp))
        using (var f = new Font("Arial", 12))
        {
            g.Clear(Color.FromArgb(214, 214, 214));
            g.InterpolationMode = System.Drawing.Drawing2D.InterpolationMode.HighQualityBicubic;
            for (int n = 0; n < paths.Length; n++)
            {
                // Hebrew sheet: the first picture sits on the right, labels read right to left
                int x = (cols - 1 - n % cols) * cell, y = (n / cols) * (cell + 26);
                using (var im = Image.FromFile(paths[n]))
                {
                    // keep the picture's own proportions, on white
                    double sc = Math.Min((cell - 4.0) / im.Width, (cell - 4.0) / im.Height);
                    int dw = (int)(im.Width * sc), dh = (int)(im.Height * sc);
                    g.FillRectangle(Brushes.White, x + 2, y + 2, cell - 4, cell - 4);
                    g.DrawImage(im, x + 2 + (cell - 4 - dw) / 2, y + 2 + (cell - 4 - dh) / 2, dw, dh);
                }
                using (var sf = new StringFormat(StringFormatFlags.DirectionRightToLeft))
                    g.DrawString(labels[n], f, Brushes.Black, new RectangleF(x + 4, y + cell + 3, cell - 10, 22), sf);
            }
            SaveJpeg(bmp, outPath, 88L);
        }
    }
}
