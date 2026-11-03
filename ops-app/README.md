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
3. ב-Authentication → Providers → Email: משאירים Email פעיל, ומכבים את "Allow new users to sign up" (נכנסים רק בהזמנה)
4. ב-Authentication → Email Templates → Magic Link: מוסיפים לתבנית את הקוד `{{ .Token }}`, כדי שיישלח קוד של 6 ספרות
5. ב-Authentication → Users → Invite: מזמינים את האימייל שלך ואת זה של ארי
6. ב-SQL Editor יוצרים לכל אחד שורה ב-profiles (את ה-id לוקחים מרשימת המשתמשים):
   `insert into profiles (id, name, role, title) values ('<id>', 'ארי', 'staff', 'מנהל מערכת ותפעול');`
7. ב-Project Settings → API מעתיקים את ה-URL ואת ה-anon key ל-`js/config.js`

## העלאה לאוויר
מעלים את כל התיקייה `ops-app` (בלי `serve.ps1` ובלי `supabase/`) לתת-דומיין, למשל ops.keterlion.com ב-cPanel של MyHost. האתר צריך HTTPS, כדי שאפשר יהיה להתקין את האפליקציה בטלפון.
