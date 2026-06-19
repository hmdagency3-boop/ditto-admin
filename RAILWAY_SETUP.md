# Railway Deployment Setup

## خطوات النشر على Railway

### 1. إنشاء الحساب والمشروع
1. سجّل دخول على [railway.app](https://railway.app)
2. اضغط **New Project**
3. اختر **Deploy from GitHub repo**
4. اربط حساب GitHub واختر الـ repository

### 2. إعداد Environment Variables
في لوحة Railway، اذهب لـ **Variables** وأضف:

| المتغير | القيمة |
|---------|--------|
| `SUPABASE_URL` | رابط مشروع Supabase |
| `SUPABASE_ANON_KEY` | مفتاح Supabase العام |
| `JWT_SECRET` | المفتاح السري للـ JWT |
| `NODE_ENV` | `production` |

> **ملاحظة:** متغير `PORT` Railway بيضبطه تلقائياً، مش محتاج تضيفه.

### 3. النشر
Railway هيبني وينشر تلقائياً بعد ربط الـ repository.

### 4. الرابط
بعد النشر هتلاقي رابطك على شكل:
`https://your-app-name.up.railway.app`
