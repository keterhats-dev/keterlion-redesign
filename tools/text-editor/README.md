# עורך הטקסטים

העמוד: https://claude.ai/artifact/HDKxaVk9nd7hsbomcL7gjY. הוא פורסם עם `index.html` ו-`texts.json`, ומוגדרות לו היכולות `db` ו-`user` (scopes: profile).

## הנתונים
**`texts.json`** נשלף מ-staging ב-29.10.2026. הוא מכיל:
- `docs`: פריטים בצורה `{id, type, name, url, order}`
- `items`: פריטים בצורה `{key, doc, el, field, kind, section, sectionIndex, order, html, text, locked}`

השדות של כל פריט:
- `key` בנוי כך: `${doc}_${el}_${field}`, כשהשדה מכיל רק אותיות וספרות
- `field` הוא אחד מאלה: `title`, `paragraph`, `text`, `editor`, `item_title:N`
- `locked` מסומן כשיש ב-html קישור, רשימה, טבלה, תמונה או iframe. פריט נעול לא עורכים בעמוד

**המאגר של העמוד** הוא collection בשם `edits`. כל מסמך מזוהה לפי `key` ומכיל:
- `value`: הטקסט החדש
- `site`: מה שמופיע באתר עכשיו
- `original`: הטקסט מ-texts.json
- `doc`, `el`, `field`, `kind`, `page`, `section`
- `status`: `pending` או `applied`
- `by`: מזהה המשתמש
- `at`: ISO
- `appliedAt`: נוסף אחרי העדכון

## מה עושים כשהמשתמש כותב "עדכן"
1. **קריאה:** `ArtifactData` `query` על `edits`, עם `status == pending`
2. **המרה מטקסט ל-html:**
   - בורחים מתווים מיוחדים (escape)
   - ירידת שורה `\n` הופכת ל-`<br>`
   - אם ב-html המקורי היה `<em>.</em>` בסוף והטקסט החדש מסתיים בנקודה, שומרים את ה-`<em>`
   - שומרים `<b>✱</b>`
   - ב-`editor`, כל פסקה (שורה ריקה ביניהן) עוברת ל-`<p>`. אם היה עיצוב (bold וכו'), מוודאים שלא הולך לאיבוד
3. **עדכון באלמנטור** של staging, לכל עמוד: `/staging/wp-admin/post.php?post=<doc>&action=elementor`
   - `$e.run('document/elements/settings', {container, settings})`
   - ווידג'טים אטומיים (`title`, `paragraph`, `text`): הערך הוא `{$$type:'escaped-html', value}`
   - כותרת קלאסית: `title`
   - כפתור קלאסי: `text`
   - עורך טקסט: `editor`
   - אקורדיון: `items[i].item_title`
   - שמירה: `document/save/publish` (ה-helper ‏KLS ב-tools/elementor-console/README.md)
4. **ניקוי המטמון של LiteSpeed:** הכל, ואחר כך גם CSS/JS
5. **בדיקה:** בודקים בעמוד עצמו שהטקסט החדש מופיע
6. **סימון:** `batch` ‏`update` עם `{status:'applied', site:value, appliedAt}` (עם `if_version`)
7. **שמירה:** מעדכנים את STATUS.md, ואז commit

כדי לשלוף מחדש את כל הטקסטים (אם נוספו עמודים), מריצים את הסקריפט מהשיחה של 29.10. ה-JSON עובר מ-WP כ-PNG, כי REST לא מקבל ‎.txt או ‎.gz. אחרי השליפה מפרסמים שוב את `texts.json` לאותו artifact.
