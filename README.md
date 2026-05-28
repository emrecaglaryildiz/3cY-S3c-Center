# 3cY-S3c-Center
3cY-S3c-Center Osint Dashboard

# 3cY-S3C | Global Cyber Threat Intelligence Dashboard

**3cY-S3C** is a highly interactive, browser-based Cyber Security Operations Center (SOC) dashboard. It visualizes global cyber threats, monitors live CVE feeds, performs real-time OSINT (Open-Source Intelligence) queries, and provides a hacker-movie aesthetic with its dark cyberpunk UI.

3cY-S3C Dashboard Interface

Screen shot -1 
<img width="2557" height="1318" alt="image" src="https://github.com/user-attachments/assets/bd990150-d06b-4e58-bfbe-89cb5b0c1758" />

Screen shot -2
<img width="2557" height="1318" alt="image" src="https://github.com/user-attachments/assets/ef590ca0-c647-4c65-a848-047218c736cc" />


## 🚀 Features

- **Interactive Threat Map (2D & 3D):** Visualizes live and simulated cyber attacks happening around the globe. Switch between a 3D WebGL Globe and a high-performance 2D Canvas Map.
- **Live OSINT Hunt Module:** Query any IP Address or Domain directly from the dashboard. Fetches real data instantly from:
  - **Shodan (InternetDB):** Open ports, vulnerabilities, and hostnames.
  - **IPWhoIs:** Geolocation data, ASN, and ISP details.
  - **NetworkCalc:** WHOIS records and domain registration information.
- **VirusTotal Integration:** One-click neon button to analyze queried targets on VirusTotal.
- **Hacker News Live Ticker:** Real-time scrolling news ticker fetching the top stories and scores from the Hacker News (Y Combinator) API.
- **Threat Feeds & CVE Monitor:** Displays recent Common Vulnerabilities and Exposures (CVE) and CISA Known Exploited Vulnerabilities (KEV).
- **Matrix-Style Terminal:** A raw intercept console that prints live system logs and threat intelligence data in a retro terminal format.
- **Immersive Audio:** Interactive sound effects for UI clicks, alarms, and OSINT scans (can be toggled).

## 🛠️ Technology Stack

This project is built purely with client-side technologies, meaning it runs entirely in the browser with no backend required:

- **HTML5 / CSS3 / JavaScript (ES6+)**
- **D3.js:** For the high-performance 2D radar map projection.
- **Globe.gl & Three.js:** For the interactive 3D WebGL world map.
- **TopoJSON:** For rendering country borders and map topography.
- **Fetch API:** For integrating with public, keyless REST APIs (Shodan, IPWhoIs, Hacker News, etc.).

## ⚙️ Installation & Usage

Since this is a static client-side web application, installation is as simple as opening a file.

1. Clone or download this repository to your local machine.
2. Open `index.html` in any modern web browser (Chrome, Firefox, Safari, Edge).
3. The dashboard will automatically initialize, fetch the latest threat intelligence, and start the attack map visualization.

> **Note:** Active internet connection is required for the OSINT Hunt module, Hacker News ticker, and map topography to load.

## 🕵️‍♂️ OSINT Hunt Module Usage

1. Click the 🔍 icon in the top right corner (or press `Ctrl+K` / `Cmd+K` if configured) to open the Hunt search bar.
2. Enter an IP Address (e.g., `8.8.8.8`) or a Domain Name (e.g., `google.com`).
3. Press `Enter`.
4. The system will simulate a scan while fetching real data from public APIs in the background.
5. Review the WHOIS, GeoIP, and Open Ports data in the modal.
6. Click the neon **"Bu hedefi VirusTotal'da İncele"** button to perform a deep threat analysis.

## 🎨 Map Modes

You can toggle between map modes using the "Harita Modu" button in the bottom left corner:
- **2D Canvas (Default):** A flat, tactical radar-style map. Highly performant.
- **3D WebGL:** A realistic, rotatable 3D globe showing global attack arcs.

## 🔒 APIs Used

This dashboard relies on the following public, free-to-use APIs (No API keys required):
- [Hacker News API](https://github.com/HackerNews/API) - Top stories ticker
- [InternetDB API (by Shodan)](https://internetdb.shodan.io/) - IP port and vulnerability lookups
- [IPWhoIs API](https://ipwhois.io/) - IP Geolocation
- [NetworkCalc API](https://networkcalc.com/) - WHOIS lookups

## 📜 License

This project is created for educational purposes, OSINT research, and aesthetic dashboard design. 

---
*Created by Emre Çağlar Yıldız & Antigravity AI*
