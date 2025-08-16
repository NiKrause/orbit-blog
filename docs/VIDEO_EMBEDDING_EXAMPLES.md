# Video Embedding Examples

This guide shows how to properly embed videos in your blog posts using iframes.

## ✅ Correct Usage

### YouTube Videos

**❌ Wrong (will be blocked):**
```markdown
<iframe src="https://www.youtube.com/watch?v=dQw4w9WgXcQ"></iframe>
```

**✅ Correct:**
```markdown
<iframe src="https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ" width="560" height="315" frameborder="0" allowfullscreen></iframe>
```

**✅ Also correct (short URL):**
```markdown
<iframe src="https://youtu.be/dQw4w9WgXcQ" width="560" height="315" frameborder="0" allowfullscreen></iframe>
```

### Vimeo Videos

**✅ Correct:**
```markdown
<iframe src="https://player.vimeo.com/video/123456789" width="560" height="315" frameborder="0" allowfullscreen></iframe>
```

### Dailymotion Videos

**✅ Correct:**
```markdown
<iframe src="https://www.dailymotion.com/embed/video/x123456" width="560" height="315" frameborder="0" allowfullscreen></iframe>
```

## 🔗 Alternative: Use Links

If iframe embedding doesn't work, you can always link to the video:

```markdown
[Watch this amazing video on YouTube](https://www.youtube.com/watch?v=dQw4w9WgXcQ)

[Check out this Vimeo video](https://vimeo.com/123456789)
```

## 🎨 Styling Options

You can customize the iframe appearance:

```markdown
<!-- Responsive iframe -->
<div style="position: relative; padding-bottom: 56.25%; height: 0; overflow: hidden; max-width: 100%;">
  <iframe src="https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ" 
          style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;" 
          frameborder="0" 
          allowfullscreen>
  </iframe>
</div>
```

## 🛡️ Security Features

All iframes are automatically:
- Sandboxed for security
- Validated against allowed domains
- Given secure attributes
- Protected against XSS attacks

## 🚫 Common Issues

1. **X-Frame-Options error**: Use embed URLs, not watch URLs
2. **Video not showing**: Check that the video ID is correct
3. **Blocked content**: Some platforms may block embedding entirely

## 📱 Mobile Considerations

Videos will be responsive by default, but you can add custom CSS for better mobile experience:

```markdown
<iframe src="https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ" 
        width="100%" 
        height="315" 
        frameborder="0" 
        allowfullscreen
        style="max-width: 100%;">
</iframe>
```
