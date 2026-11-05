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
                using (var im = Image.FromFile(paths[n])) g.DrawImage(im, x + 2, y + 2, cell - 4, cell - 4);
                using (var sf = new StringFormat(StringFormatFlags.DirectionRightToLeft))
                    g.DrawString(labels[n], f, Brushes.Black, new RectangleF(x + 4, y + cell + 3, cell - 10, 22), sf);
            }
            SaveJpeg(bmp, outPath, 88L);
        }
    }
}
