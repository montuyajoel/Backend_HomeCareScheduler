//import { createTransport } from "nodemailer";
const { createTransport } = require("nodemailer")
//nodemailer is the standard Node.js library for sending emails
//create a transporter- the mail server connection
const sendEmail = async ({ to, subject, text }) => {
    //sending email by the SMTP sever in Gmail
    const transporter = createTransport({
        //service: "gmail",
        host: process.env.EMAIL_HOST,
        port: Number(process.env.EMAIL_PORT),
        auth: {
            user: process.env.EMAIL_USER, //gmail address stored in .env
            pass: process.env.EMAIL_PASS,//gmail app password, not the gmail login password
            //generate at: google account->security ->app passwords
            
        },
    });
    const mailOptions = {
        //display name + sender address
        from: `"HomeCare Scheduler" <${process.env.EMAIL_USER}>`,
        to, 
        subject,
        text,   
    };

    await transporter.sendMail(mailOptions);
    //sendMail is async, await ensures we  catch any sending errors

};
module.exports = { sendEmail };