import ytdl from '@distube/ytdl-core';
import express, { Request, Response } from 'express';

const app = express();
const PORT = process.env.PORT || 3000;

// Enable JSON body parsing
app.use(express.json());

app.post('/download', async (req: Request, res: Response) => {
  try {
    const { url } = req.body;

    if (!url || !ytdl.validateURL(url)) {
      return res.status(400).json({ error: 'Invalid YouTube URL' });
    }

    // Fetch video info
    const info = await ytdl.getInfo(url);
    const title = info.videoDetails.title.replace(/[^\w\s]/gi, '');

    // Get mp4 video+audio
    const format = ytdl.chooseFormat(info.formats, { quality: 'highest' });

    // Prepare download headers
    res.setHeader('Content-Disposition', `attachment; filename="${title}.mp4"`);
    res.setHeader('Content-Type', 'video/mp4');

    // Pipe stream directly to client
    ytdl(url, { format })
      .pipe(res)
      .on('error', (err) => {
        console.error('Streaming error:', err);
        res.status(500).end('Streaming error');
      });
  } catch (err) {
    console.error('Server error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
