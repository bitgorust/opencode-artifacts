---
title: مراجعة الإشارات
description: RTL accessibility, locale, keyboard, chart, table, and comment fixture
lang: ar
dir: rtl
locale: ar-EG
timezone: Asia/Riyadh
---
# مراجعة الإشارات

هذه صفحة تحقق ثابتة لقراءة المحتوى العربي والتنقل بلوحة المفاتيح.

> [!NOTE] الملخص واضح ولا يعتمد على اللون وحده.

## حالة المراجعة

- [x] اكتملت مراجعة البيانات
- [ ] بقيت مراجعة التعليقات

```progress
{"label":"تقدم المراجعة","done":3,"total":4}
```

## اتجاه الإشارة

```echarts
{"description":"ترتفع الإشارة من ثلاث نقاط إلى خمس نقاط خلال يومين.","xAxis":{"type":"category","data":["الاثنين","الثلاثاء"]},"yAxis":{"type":"value"},"series":[{"type":"line","data":[3,5]}]}
```

## سجل القياسات

```table
{"caption":"سجل الإشارات","columns":[{"key":"label","label":"الفئة"},{"key":"count","label":"العدد","type":"num"},{"key":"captured","label":"وقت الالتقاط","type":"datetime"}],"rows":[{"label":"ألفا","count":1234.5,"captured":"2026-08-17T15:00:00Z"},{"label":"بيتا","count":987.25,"captured":"2026-08-18T06:30:00+03:00"}]}
```

## القرار التالي

```decisions
{"title":"قرار النشر","questions":[{"id":"next","question":"ما الخطوة التالية؟","options":[{"id":"ship","label":"نشر","note":"بعد اكتمال المراجعة"},{"id":"hold","label":"انتظار"}]}]}
```

يمكن إضافة تعليق على الصفحة من زر التعليقات عند تشغيل الخادم المحلي.
