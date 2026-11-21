# InsureFlow Core

Build the foundation of an insurance CRM called InsureFlow.

Set up Supabase auth with email/password login for advisors (agency staff).

Each advisor belongs to an organization (agency). Add a simple org signup flow:

new user creates an org, or joins one via invite code.

Create a Contacts module with a table for:

- name, phone, email, gender, age, date of birth

- occupation, city, income, preferred language

- lead source, tags (array)

- whatsapp_opt_in, sms_opt_in, email_opt_in (booleans)

- preferred_channel (enum: whatsapp/sms/email)

- lead_score (integer, default 0)

- pipeline_stage (enum: new/contacted/qualified/proposal/won/lost)

- last_contact_at, next_followup_at (timestamps)

- notes (text)

Build a Contacts list page with a table view: searchable, filterable by

pipeline stage and tag, sortable by lead score and next follow-up. Add a

detail view/drawer per contact showing all fields, editable inline.

Add a manual "Add Contact" form and a CSV import flow that maps columns to

these fields and flags duplicate phone/email before import.

Use Supabase RLS so each org only sees its own contacts. Use shadcn/ui

components and keep the design clean and data-dense, appropriate for daily

use by insurance advisors.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://insureflows.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/3771dd08-7928-47b4-93de-eee0ccefa18b).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
