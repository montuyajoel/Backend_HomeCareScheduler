//import { createTransport } from "nodemailer";
//nodemailer is the standard Node.js library for sending emails
//create a transporter- the mail server connection

const { createTransport } = require("nodemailer");
const { logExternal } = require("../middleware/logger");

const sendEmail = async ({ to, subject, text }) => {
    const startTime = Date.now();
    try{
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
            text
        };

        const info = await transporter.sendMail(mailOptions);
        //sendMail is async, await ensures we  catch any sending errors
        const durationMs = Date.now() - startTime;
        //logExternal('SMTP', `Email sent to ${to} with subject "${subject}"`, info.response || 'OK', durationMs));
        logExternal('SMTP', `Sent email to ${to} ("${subject}") - ${info.response || 'OK'}`, 200, durationMs);
        console.log(`Email sent to ${to} with subject "${subject}"`);
        return info;

    } catch (error) {
        const durationMs = Date.now() - startTime;
        //logExternal('SMTP', `Failed sending email to ${to} with subject "${subject}": ${error.message}`, error.response?.status || 'FAILED', durationMs);
        logExternal('SMTP', `Failed sending email to ${to}: ${error.message}`, 'FAILED', durationMs);
        console.error(`Error sending email to ${to} with subject "${subject}": ${error.message}`);
        throw error;
    }

};
module.exports = { sendEmail };