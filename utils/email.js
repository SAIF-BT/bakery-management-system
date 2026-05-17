const nodemailer = require('nodemailer');
require('dotenv').config();

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// ── Verification email ──────────────────────────────────────
const sendVerificationEmail = async (toEmail, name, token) => {
  const link = `${process.env.BASE_URL}/api/auth/verify/${token}`;
  await transporter.sendMail({
    from:    process.env.EMAIL_FROM,
    to:      toEmail,
    subject: '🎂 Verify your Sweet Crust Bakery account',
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;border:1px solid #eee;border-radius:10px;overflow:hidden">
        <div style="background:#8B4513;padding:30px;text-align:center">
          <h1 style="color:#fff;margin:0">🍰 Sweet Crust Bakery</h1>
        </div>
        <div style="padding:30px">
          <h2 style="color:#333">Welcome, ${name}!</h2>
          <p style="color:#666;font-size:16px">Thank you for registering. Please verify your email address to activate your account.</p>
          <div style="text-align:center;margin:30px 0">
            <a href="${link}" style="background:#8B4513;color:#fff;padding:14px 32px;border-radius:6px;text-decoration:none;font-size:16px;font-weight:bold">
              ✅ Verify My Account
            </a>
          </div>
          <p style="color:#999;font-size:13px">This link expires in 24 hours. If you didn't register, ignore this email.</p>
        </div>
        <div style="background:#f9f9f9;padding:15px;text-align:center">
          <p style="color:#999;font-size:12px;margin:0">© 2025 Sweet Crust Bakery, Karachi</p>
        </div>
      </div>
    `
  });
};

// ── Order confirmation email ────────────────────────────────
const sendOrderConfirmationEmail = async (toEmail, name, order) => {
  const itemRows = order.items.map(item => `
    <tr>
      <td style="padding:10px;border-bottom:1px solid #eee">${item.p_name}</td>
      <td style="padding:10px;border-bottom:1px solid #eee;text-align:center">${item.quantity}</td>
      <td style="padding:10px;border-bottom:1px solid #eee;text-align:right">Rs. ${item.price}</td>
      <td style="padding:10px;border-bottom:1px solid #eee;text-align:right">Rs. ${item.price * item.quantity}</td>
    </tr>
  `).join('');

  await transporter.sendMail({
    from:    process.env.EMAIL_FROM,
    to:      toEmail,
    subject: `🧁 Order #${order.order_id} Confirmed — Sweet Crust Bakery`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;border:1px solid #eee;border-radius:10px;overflow:hidden">
        <div style="background:#8B4513;padding:30px;text-align:center">
          <h1 style="color:#fff;margin:0">🍰 Sweet Crust Bakery</h1>
        </div>
        <div style="padding:30px">
          <h2 style="color:#333">Thank you, ${name}! 🎉</h2>
          <p style="color:#666">Your order has been confirmed. Here are your order details:</p>
          <div style="background:#f9f9f9;border-radius:8px;padding:15px;margin:20px 0">
            <p style="margin:5px 0;color:#333"><strong>Order ID:</strong> #${order.order_id}</p>
            <p style="margin:5px 0;color:#333"><strong>Date:</strong> ${new Date(order.order_date).toLocaleDateString()}</p>
            <p style="margin:5px 0;color:#333"><strong>Payment:</strong> ${order.payment_method}</p>
            <p style="margin:5px 0;color:#333"><strong>Status:</strong> <span style="color:#8B4513;font-weight:bold">${order.status.toUpperCase()}</span></p>
          </div>
          <table style="width:100%;border-collapse:collapse">
            <thead>
              <tr style="background:#8B4513;color:#fff">
                <th style="padding:10px;text-align:left">Item</th>
                <th style="padding:10px;text-align:center">Qty</th>
                <th style="padding:10px;text-align:right">Price</th>
                <th style="padding:10px;text-align:right">Total</th>
              </tr>
            </thead>
            <tbody>${itemRows}</tbody>
            <tfoot>
              <tr>
                <td colspan="3" style="padding:12px;text-align:right;font-weight:bold;font-size:16px">Grand Total:</td>
                <td style="padding:12px;text-align:right;font-weight:bold;font-size:16px;color:#8B4513">Rs. ${order.total}</td>
              </tr>
            </tfoot>
          </table>
          <p style="color:#666;margin-top:20px">We'll notify you when your order is ready. Thank you for choosing Sweet Crust Bakery!</p>
        </div>
        <div style="background:#f9f9f9;padding:15px;text-align:center">
          <p style="color:#999;font-size:12px;margin:0">© 2025 Sweet Crust Bakery, Karachi</p>
        </div>
      </div>
    `
  });
};

// ── Order status update email ───────────────────────────────
const sendOrderStatusEmail = async (toEmail, name, orderId, status) => {
  const statusMessages = {
    preparing:  { emoji: '👨‍🍳', msg: 'Our bakers are preparing your order!' },
    ready:      { emoji: '✅', msg: 'Your order is ready for pickup/delivery!' },
    delivered:  { emoji: '🎉', msg: 'Your order has been delivered. Enjoy!' },
    cancelled:  { emoji: '❌', msg: 'Your order has been cancelled.' }
  };
  const info = statusMessages[status] || { emoji: '📦', msg: `Your order status: ${status}` };

  await transporter.sendMail({
    from:    process.env.EMAIL_FROM,
    to:      toEmail,
    subject: `${info.emoji} Order #${orderId} Update — Sweet Crust Bakery`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;border:1px solid #eee;border-radius:10px;overflow:hidden">
        <div style="background:#8B4513;padding:30px;text-align:center">
          <h1 style="color:#fff;margin:0">🍰 Sweet Crust Bakery</h1>
        </div>
        <div style="padding:30px;text-align:center">
          <div style="font-size:60px">${info.emoji}</div>
          <h2 style="color:#333">Order #${orderId} Update</h2>
          <p style="color:#666;font-size:16px">Hi ${name}, ${info.msg}</p>
          <div style="background:#f9f9f9;border-radius:8px;padding:15px;margin:20px 0;display:inline-block">
            <p style="margin:0;color:#8B4513;font-weight:bold;font-size:18px">${status.toUpperCase()}</p>
          </div>
        </div>
        <div style="background:#f9f9f9;padding:15px;text-align:center">
          <p style="color:#999;font-size:12px;margin:0">© 2025 Sweet Crust Bakery, Karachi</p>
        </div>
      </div>
    `
  });
};

// ── Password reset email ────────────────────────────────────
const sendPasswordResetEmail = async (toEmail, name, token) => {
  const link = `${process.env.BASE_URL}/reset-password.html?token=${token}`;
  await transporter.sendMail({
    from:    process.env.EMAIL_FROM,
    to:      toEmail,
    subject: '🔐 Reset your Sweet Crust Bakery password',
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;border:1px solid #eee;border-radius:10px;overflow:hidden">
        <div style="background:#8B4513;padding:30px;text-align:center">
          <h1 style="color:#fff;margin:0">🍰 Sweet Crust Bakery</h1>
        </div>
        <div style="padding:30px">
          <h2 style="color:#333">Password Reset Request</h2>
          <p style="color:#666">Hi ${name}, we received a request to reset your password.</p>
          <div style="text-align:center;margin:30px 0">
            <a href="${link}" style="background:#8B4513;color:#fff;padding:14px 32px;border-radius:6px;text-decoration:none;font-size:16px;font-weight:bold">
              🔐 Reset My Password
            </a>
          </div>
          <p style="color:#999;font-size:13px">This link expires in 1 hour. If you didn't request this, ignore this email.</p>
        </div>
        <div style="background:#f9f9f9;padding:15px;text-align:center">
          <p style="color:#999;font-size:12px;margin:0">© 2025 Sweet Crust Bakery, Karachi</p>
        </div>
      </div>
    `
  });
};

module.exports = {
  sendVerificationEmail,
  sendOrderConfirmationEmail,
  sendOrderStatusEmail,
  sendPasswordResetEmail
};