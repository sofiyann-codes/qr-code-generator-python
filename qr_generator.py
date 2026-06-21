import qrcode

# Ask user for the link/text to encode
url = input("Enter the URL or text: ").strip()

# Create a QR code object
qr = qrcode.QRCode(
    version=1, 
    box_size=10,
    border=4
)

# Add the data
qr.add_data(url)
qr.make(fit=True)

# Create the image
img = qr.make_image(fill_color="black", back_color="white")

# Save as file
file_name = "my_qr_code.png"
img.save(file_name)

print(f"QR Code generated and saved as {file_name} ✅")
