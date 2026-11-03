# מערכת המשימות של כתרליון (ops-app)

אפליקציית רשת לטלפון ולמחשב: משימות לצוות, עדיפויות, תחומים, צ'קליסט ושרשור תגובות. בלי שלב בנייה: אלה קבצי HTML, CSS ו-JS רגילים, והספריות נטענות מ-CDN (Preact ו-htm, וגם Supabase).

## הרצה מקומית
מתוך Claude: preview בשם `ops-app` (מוגדר ב-.claude/launch.json). או ב-PowerShell:
`powershell -ExecutionPolicy Bypass -File ops-app/serve.ps1`, ואז פותחים http://localhost:5510/

## מצב הדגמה
כל עוד `js/config.js` ריק, האפליקציה רצה בהדגמה. הנתונים נשמרים רק בדפדפן, ובכניסה בוחרים מי נכנס.

## חיבור ל-Supabase (פעם אחת)
1. בעל העסק פותח חשבון ופרויקט ב-supabase.com, באזור Frankfurt (eu-central-1)
2. ב-SQL Editor מריצים את `supabase/schema.sql`
3. ב-Authentication → Providers → Email: משאירים את Email פעיל. ההרשמה נשארת פתוחה, אבל זה לא מסוכן: מי שלא הוזמן מקבל "אין לך גישה", ולא רואה שום נתון
4. ב-Authentication → Email Templates → Magic Link: מוסיפים לתבנית את הקוד `{{ .Token }}`, כדי שיישלח קוד של 6 ספרות
5. המנהל הראשון: בסוף schema.sql יש שורה עם `insert into team_invites`. מכניסים בה את האימייל והשם שלך, ומריצים אותה פעם אחת
6. ב-Project Settings → API מעתיקים את ה-URL ואת ה-anon key ל-`js/config.js`
7. נכנסים לאפליקציה עם האימייל שלך. את ארי ואת שאר הצוות מוסיפים מתוך האפליקציה: צוות ← הוספת איש צוות

## העלאה לאוויר
מעלים את כל התיקייה `ops-app` (בלי `serve.ps1` ובלי `supabase/`) לתת-דומיין, למשל ops.keterlion.com ב-cPanel של MyHost. האתר צריך HTTPS, כדי שאפשר יהיה להתקין את האפליקציה בטלפון.
