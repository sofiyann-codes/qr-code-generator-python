# QR Code Generator using Python

A simple and customizable QR Code Generator built using Python — now with a live web interface too.

This project lets you generate QR codes for URLs, text, Wi-Fi credentials, and contact cards (vCard), either from the command line with Python or directly in the browser.

---

## 🌐 Live Demo

Try it instantly in your browser — no install needed:

**[sofiyann-codes.github.io/qr-code-generator-python](https://sofiyann-codes.github.io/qr-code-generator-python/)**

The web version runs entirely client-side (no server, nothing uploaded) and supports:
- Text / URL QR codes
- Wi-Fi QR codes (auto-connect on scan)
- Contact card QR codes (vCard)
- Custom colors, size, and error-correction level
- Instant PNG download or copy-to-clipboard

---

## 🚀 Features

- Generate QR codes for text and URLs
- Create Wi-Fi QR codes (auto-connect on scan)
- Generate contact QR codes (vCard)
- Customize QR size and colors
- Save QR codes as PNG images

---

## 🛠️ Technologies Used

**Python script:**
- Python 3
- `qrcode` library
- Pillow (PIL)

**Web interface:**
- HTML, CSS, JavaScript (vanilla, no build step)
- [qrcodejs](https://github.com/davidshimjs/qrcodejs) for in-browser QR rendering

---

## 💻 Running the Python script locally

1. Install Python 3
2. Install requirements:
   ```bash
   python -m pip install -r requirements.txt
   ```
3. Run:
   ```bash
   python qr_generator.py
   ```
4. Enter a URL or text when prompted — your QR code saves as `my_qr_code.png` in the same folder.

---

## 🖥️ Running the web interface locally

No install required. Either:

- Open `index.html` directly in your browser, **or**
- Serve it locally for the best experience:
  ```bash
  python -m http.server 8000
  ```
  then visit `http://localhost:8000`

---

## 📁 Project Structure

```
qr-code-generator-python/
├── qr_generator.py     # Python CLI script
├── requirements.txt    # Python dependencies
├── index.html          # Web interface
├── style.css           # Web interface styling
├── script.js           # Web interface logic
└── README.md
```

---

## Author

Mohammed Sofiyan Pasha
