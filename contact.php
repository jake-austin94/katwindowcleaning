<?php
// Retrieve form data
$name = $_POST['Name'];
$email = $_POST['Email'];
$phoneNumber = $_POST['PhoneNumber'];
$message = $_POST['Message'];

// Validate form data (you can add more validation if needed)
if (empty($name) || empty($email) || empty($message)) {
    // Handle validation error (e.g., display an error message to the user)
    echo "Please fill in all the required fields.";
    exit;
}

// Set up email parameters
$to = "info@katwindowcleaning.com"; // Email recipient
$from = "info@katwindowcleaning.com"; // Email sender
$subject = "New Contact Form Submission";
$headers = "From: $from\r\n";
$headers .= "Reply-To: $email\r\n";
$messageBody = "Name: $name\n";
$messageBody .= "Email: $email\n";
$messageBody .= "Phone Number: $phoneNumber\n";
$messageBody .= "Message:\n$message";

// Send email
if (mail($to, $subject, $messageBody, $headers)) {
    // Email sent successfully
    echo "Thank you for your message. We will get back to you soon.";
} else {
    // Failed to send email
    echo "Sorry, there was an error sending your message. Please try again later.";
}
?>
