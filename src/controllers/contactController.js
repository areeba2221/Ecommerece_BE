const Contact = require("../models/ContactModel");
const asyncHandler = require("../middleware/asyncHandler");
const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host: "smtp-relay.brevo.com",
  port: 587,
  secure: false,
  auth: {
    user: process.env.BREVO_USER,       
    pass: process.env.BREVO_SMTP_KEY,   
  },
  tls: {
    rejectUnauthorized: false,          
  },
});

transporter.verify((error) => {
  if (error) {
    console.error("SMTP connection failed:", error.message);
  } else {
    console.log("SMTP server is ready");
  }
});

const createContactMessage = asyncHandler(async (req, res) => {
  const { name, email, phone, subject, message } = req.body;

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!name || !email || !message) {
    res.status(400);
    throw new Error("Please fill all required fields");
  }
  if (!emailRegex.test(email)) {
    res.status(400);
    throw new Error("Please provide a valid email address");
  }

  const contact = await Contact.create({
    name,
    email,
    phone,
    subject,
    message,
    status: "Pending",
  });

  // Admin notification email
  try {
    
    const info = await transporter.sendMail({
      from: `"Website Contact" <${process.env.BREVO_SENDER_EMAIL}>`,
      to: process.env.BREVO_SENDER_EMAIL,
      replyTo: email,                                                 
      subject: `New Contact Message - ${subject || "No Subject"}`,
      html: `
        <h2>New Customer Contact Request</h2>
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Phone:</strong> ${phone || "N/A"}</p>
        <p><strong>Subject:</strong> ${subject || "N/A"}</p>
        <p><strong>Message:</strong></p>
        <p>${message}</p>
      `,
    });
  } catch (error) {
    console.error("Admin email failed:", error.message);
  }

  // Customer confirmation email
  try {
    const info = await transporter.sendMail({
      from: `"Support Team" <${process.env.BREVO_SENDER_EMAIL}>`, 
      to: email.trim(),
      subject: "We Have Received Your Message",
      html: `
        <h2>Hello ${name},</h2>
        <p>Thank you for contacting us.</p>
        <p>Your message has been received successfully.</p>
        <p><strong>Status:</strong> Pending</p>
        <p>Our team will contact you soon.</p>
        <br/>
        <p>Best Regards,</p>
        <p>Customer Support Team</p>
      `,
    });
    
  } catch (error) {
    console.error("User email failed:", error.message);
  }

  res.status(201).json({
    success: true,
    message: "Message submitted successfully",
    data: contact,
  });
});

const getAllContacts = asyncHandler(async (req, res) => {
  const contacts = await Contact.find().sort({ createdAt: -1 });

  res.status(200).json({
    success: true,
    count: contacts.length,
    data: contacts,
  });
});

const updateContactStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;

  const contact = await Contact.findById(req.params.id);

  if (!contact) {
    res.status(404);
    throw new Error("Contact message not found");
  }

  contact.status = status || contact.status;
  const updatedContact = await contact.save();

  try {
    await transporter.sendMail({
      from: `"Support Team" <${process.env.BREVO_SENDER_EMAIL}>`,  
      to: updatedContact.email,
      subject: "Support Request Status Updated",
      html: `
        <h2>Hello ${updatedContact.name},</h2>
        <p>Your request status has been updated.</p>
        <p><strong>New Status:</strong> ${updatedContact.status}</p>
        <p>Thank you.</p>
      `,
    });
    console.log("Status email sent");
  } catch (error) {
    console.error("Status email failed:", error.message);
  }

  res.status(200).json({
    success: true,
    message: "Status updated successfully",
    data: updatedContact,
  });
});

module.exports = {
  createContactMessage,
  getAllContacts,
  updateContactStatus,
};