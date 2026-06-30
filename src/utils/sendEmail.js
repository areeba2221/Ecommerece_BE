const nodemailer = require("nodemailer");

const sendEmail = async ({ email, subject, message }) => {
  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_PASS,
      },
    });

    const mailoption = {
      from: `"Furniro Support" <${process.env.GMAIL_USER}>`,
      to: email,
      subject: subject,
      html: message,
    };
    await transporter.sendMail(mailoption);
    console.log(`Email successfully sent to ${email}`);
  } catch (error) {
    console.log(`Failed to send email to ${email}: ${error.message}`);
  }
};

module.exports = sendEmail;
