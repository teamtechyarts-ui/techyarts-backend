const nodemailer = require('nodemailer');

function createTransporter() {
    const user = process.env.SMTP_USER || 'thetechyarts@gmail.com';
    const pass = process.env.SMTP_PASS;

    if (!pass || pass.includes('your-google-app-password')) {
        return null;
    }

    return nodemailer.createTransport({
        service: 'gmail',
        auth: { user, pass },
        connectionTimeout: 6000,
        greetingTimeout: 5000,
        socketTimeout: 8000
    });
}

function buildDraftAlertHtml(draft, adminUrl) {
    const keywordsList = Array.isArray(draft.tags) ? draft.tags.slice(0, 4).join(' &bull; ') : 'TechyArts';

    return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>New Technical Draft Ready for Review</title>
        <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #050505; color: #f1f5f9; margin: 0; padding: 32px 16px; -webkit-font-smoothing: antialiased; }
            .wrapper { max-width: 620px; margin: 0 auto; background: #0c0d12; border: 1px solid rgba(255,255,255,0.12); border-radius: 18px; overflow: hidden; box-shadow: 0 25px 60px rgba(0,0,0,0.9); }
            
            /* Header */
            .header-bar { padding: 36px 36px 28px; background: linear-gradient(180deg, #12131c 0%, #0c0d12 100%); border-bottom: 1px solid rgba(255,255,255,0.08); text-align: left; }
            .brand-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; }
            .logo-text { font-size: 22px; font-weight: 900; letter-spacing: -0.04em; color: #ffffff; text-decoration: none; }
            .logo-dot { color: #10b981; }
            .badge-live { display: inline-block; padding: 4px 12px; background: rgba(16,185,129,0.12); border: 1px solid rgba(16,185,129,0.35); border-radius: 9999px; color: #10b981; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.1em; }
            
            .article-headline { font-size: 23px; font-weight: 800; color: #ffffff; line-height: 1.25; letter-spacing: -0.02em; margin: 0 0 12px; }
            .meta-strip { font-size: 12px; color: #94a3b8; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; }
            .meta-accent { color: #00f0ff; }

            /* Content Body */
            .body-container { padding: 36px; }
            
            .takeaway-card { background: rgba(0, 240, 255, 0.04); border-left: 3px solid #00f0ff; border-radius: 0 10px 10px 0; padding: 20px 22px; margin-bottom: 28px; }
            .takeaway-tag { font-size: 11px; font-weight: 800; letter-spacing: 0.12em; color: #00f0ff; text-transform: uppercase; margin-bottom: 6px; display: block; }
            .takeaway-quote { font-size: 14.5px; line-height: 1.6; color: #e2e8f0; margin: 0; font-weight: 500; font-style: italic; }

            .intel-grid { margin: 0 0 32px; padding: 0; list-style: none; font-size: 13.5px; line-height: 1.8; color: #94a3b8; }
            .intel-grid li { margin-bottom: 8px; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 8px; }
            .intel-grid li:last-child { border-bottom: none; }
            .intel-label { color: #64748b; font-weight: 600; width: 140px; display: inline-block; text-transform: uppercase; font-size: 11px; letter-spacing: 0.06em; }
            .intel-val { color: #f1f5f9; font-weight: 600; }
            .intel-val.slug { font-family: monospace; color: #38bdf8; }

            /* CTA Section */
            .cta-box { text-align: center; margin: 36px 0 12px; }
            .btn-review { display: inline-block; padding: 16px 36px; background: #10b981; color: #050505 !important; font-weight: 800; font-size: 14.5px; text-decoration: none; border-radius: 12px; box-shadow: 0 0 30px rgba(16,185,129,0.45); letter-spacing: 0.02em; transition: all 0.2s ease; }
            .btn-subtext { font-size: 12px; color: #64748b; margin-top: 10px; }

            /* Footer */
            .footer-bar { padding: 28px 36px; background: #08080c; border-top: 1px solid rgba(255,255,255,0.06); text-align: center; font-size: 12px; color: #64748b; }
            .footer-bar p { margin: 0 0 6px; }
            .footer-bar a { color: #94a3b8; text-decoration: none; }
            .security-pill { display: inline-block; margin-top: 8px; font-size: 11px; color: #10b981; }
        </style>
    </head>
    <body>
        <div class="wrapper">
            <div class="header-bar">
                <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 18px;">
                    <tr>
                        <td align="left">
                            <span class="logo-text">Techyarts<span class="logo-dot">.</span></span>
                        </td>
                        <td align="right">
                            <span class="badge-live">&bull; Daily Draft Pending</span>
                        </td>
                    </tr>
                </table>

                <h1 class="article-headline">${draft.title}</h1>
                <div class="meta-strip">
                    <span class="meta-accent">${draft.category}</span> &bull; 
                    <span>${draft.readTime}</span> &bull; 
                    <span>Scheduled for Publication</span>
                </div>
            </div>

            <div class="body-container">
                <div class="takeaway-card">
                    <span class="takeaway-tag">&bull; Executive Summary &amp; Core Insight</span>
                    <p class="takeaway-quote">&ldquo;${draft.excerpt}&rdquo;</p>
                </div>

                <ul class="intel-grid">
                    <li>
                        <span class="intel-label">SEO Keywords:</span>
                        <span class="intel-val">${keywordsList}</span>
                    </li>
                    <li>
                        <span class="intel-label">Target Slug:</span>
                        <span class="intel-val slug">/blogs/${draft.slug}</span>
                    </li>
                    <li>
                        <span class="intel-label">Author Byline:</span>
                        <span class="intel-val">${draft.author ? draft.author.name : 'TechyArts Engineering'}</span>
                    </li>
                    <li>
                        <span class="intel-label">Live Status:</span>
                        <span class="intel-val" style="color: #f59e0b;">Draft (Hidden from public &amp; Google)</span>
                    </li>
                </ul>

                <div class="cta-box">
                    <a href="${adminUrl}" class="btn-review">
                        &rarr; Review &amp; Publish in Admin Control Room
                    </a>
                    <p class="btn-subtext">Clicking opens the visual editor with 1-click live publishing.</p>
                </div>
            </div>

            <div class="footer-bar">
                <p>&copy; 2026 TechyArts Digital Agency &bull; Hyderabad, India &bull; <a href="https://techyarts.com">techyarts.com</a></p>
                <p>Human Verification Air-Gap: No article is published without administrator sign-off.</p>
                <span class="security-pill">&check; End-to-End Encrypted Notification Service</span>
            </div>
        </div>
    </body>
    </html>
    `;
}

async function sendDraftAlertEmail(draft) {
    const recipient = process.env.ADMIN_ALERT_EMAIL || process.env.SMTP_USER || 'thetechyarts@gmail.com';
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const adminUrl = `${baseUrl}/admin/blogs`;

    console.log(`[Mailer] Preparing draft notification for: "${draft.title}" to ${recipient}`);

    const transporter = createTransporter();
    if (!transporter) {
        console.log('[Mailer] SMTP password is not yet configured in server/.env (using local logging).');
        console.log(`[Mailer] Notification simulated successfully. Review link: ${adminUrl}`);
        return { success: true, simulated: true, recipient };
    }

    try {
        const info = await transporter.sendMail({
            from: `"TechyArts Publishing" <${process.env.SMTP_USER || 'thetechyarts@gmail.com'}>`,
            to: recipient,
            subject: `📝 Daily Draft Ready for Review: "${draft.title}"`,
            html: buildDraftAlertHtml(draft, adminUrl)
        });

        console.log('[Mailer] Email dispatched successfully! Message ID:', info.messageId);
        return { success: true, messageId: info.messageId, recipient };
    } catch (err) {
        console.error('[Mailer] Error delivering notification email:', err.message);
        return { success: false, error: err.message };
    }
}

module.exports = {
    sendDraftAlertEmail
};
