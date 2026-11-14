# Holicon Energy — Email + WhatsApp build

## Preview
Open `index.html` for a local visual preview. WhatsApp links work, but **email submissions require the Node server and valid SMTP settings**. No CRM APIs are used.

## Configure email delivery
1. Install Node.js 20+ on a secure server or hosting platform supporting Node.
2. In `server/`, run `npm install`.
3. Copy `.env.example` to `.env` and set SMTP credentials from your email provider. Keep `.env` secret; never commit it to source control.
4. Run `npm start` in `server/` and visit `http://localhost:3000`.
5. Test with dummy enquiries and verify delivery to `admin@holiconenergy.co.uk` including attachments, spam folder and reply-to address.
6. Deploy behind HTTPS, configure SPF/DKIM/DMARC for sending domain, and use monitored hosting. Configure the sender mailbox with your email provider.

## WhatsApp
WhatsApp Business number `07507 692698` is linked using `https://wa.me/447507692698`. The website builds a pre-filled message from the selected route and technical issue. The user must explicitly send the message in WhatsApp. No WhatsApp API or chatbot is involved.

## Launch checklist
- Verify WhatsApp Business number and test mobile/deep link.
- Add actual privacy notice and cookie policy if needed; confirm lawful basis, retention and access controls.
- Configure backups, error monitoring, email provider limits, malware scanning of uploaded files, and anti-bot protection.
- Ensure mail provider accepts total message/attachment sizes; currently max 4 × 10 MB on input (may exceed mail limits).
- Configure production hostname, HTTPS and staging test recipient; do not use live customer data for testing.
- Verify office triage for maintenance requests; do not promise 24/7 emergency response.
- Revisit accessibility, SEO and manufacturer-specific help guides before public launch.

## Security notes
The demo backend uses in-memory attachment processing, basic type/size checks and IP rate limiting. Before public launch, add file-signature verification, malware scanning, strict deployment-level request limits, anti-spam measures and operational alerting. Do not deploy unreviewed code as a production service.
