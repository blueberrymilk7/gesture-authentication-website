# ESP32 ↔ Website — Complete Code Explanation

> **Audience**: You know the basics of C/C++ (Arduino), JavaScript, and HTML but are still new to advanced concepts. Every concept, keyword, and function used across **all five files** is explained below, along with diagrams of how data moves through the entire system.

---

## Table of Contents

1. [Big-Picture Overview](#1-big-picture-overview)
2. [Hardware & Communication Concepts](#2-hardware--communication-concepts)
3. [Sensors & Components — Detailed Hardware Guide](#3-sensors--components--detailed-hardware-guide)
4. [File-by-File Breakdown](#4-file-by-file-breakdown)
   - 4.1 [`sensor.txt` — ESP32 Sensor Node (Arduino)](#41-sensortxt--esp32-sensor-node-arduino)
   - 4.2 [`logic.txt` — ESP32 Logic Node (Arduino)](#42-logictxt--esp32-logic-node-arduino)
   - 4.3 [`server.js` — Node.js Backend](#43-serverjs--nodejs-backend)
   - 4.4 [`login.html` — Browser Login Page](#44-loginhtml--browser-login-page)
   - 4.5 [`admin-dashboard.html` — Admin Dashboard](#45-admin-dashboardhtml--admin-dashboard)
5. [Complete Program Flow — Authentication](#5-complete-program-flow--authentication)
6. [Complete Program Flow — Create Password](#6-complete-program-flow--create-password)
7. [All Functions Reference Table](#7-all-functions-reference-table)
8. [All Keywords & Concepts Glossary](#8-all-keywords--concepts-glossary)

---

## 1. Big-Picture Overview

This project is a **Gesture-Based Authentication System** for a School Portal. Instead of typing a text password, users authenticate by performing **6 hand gestures** on a physical sensor. The system has **four main parts**:

```
┌──────────────┐   ESP-NOW    ┌──────────────┐   HTTP/HTTPS   ┌──────────────┐   HTTP    ┌──────────────┐
│  ESP32 #1    │◄────────────►│  ESP32 #2    │◄──────────────►│  Node.js     │◄────────►│  Browser     │
│  SENSOR NODE │  (wireless)  │  LOGIC NODE  │   (WiFi/web)   │  SERVER      │  (web)   │  (Frontend)  │
│              │              │              │                │  (server.js) │          │  login.html  │
│  Reads hand  │              │  Compares    │                │              │          │  admin.html  │
│  gestures    │              │  gestures,   │                │  PostgreSQL  │          │              │
│  from PAJ7620│              │  talks to    │                │  Database    │          │              │
│  sensor      │              │  the server  │                │              │          │              │
└──────────────┘              └──────────────┘                └──────────────┘          └──────────────┘
```

### How they connect:

| Connection | Technology | What travels |
|---|---|---|
| Sensor Node ↔ Logic Node | **ESP-NOW** (direct wireless, no router needed) on **channel 6** | Gesture codes (numbers 1–8), mode commands, ack codes |
| Logic Node ↔ Server | **HTTP over WiFi** (connects to your WiFi router, then the internet) | JSON payloads carrying commands, passwords, and auth results |
| Browser ↔ Server | **HTTP** (standard web requests) | JSON payloads carrying usernames, tokens, statuses |

### Why Channel Synchronisation Matters

ESP-NOW is a wireless protocol that operates on a specific **WiFi channel** (1–13). Both ESP32 boards must be on the **same channel** or they cannot communicate. In this project:
- The **Logic Node** connects to a WiFi network (SSID: "mikhail"), and the router assigns it whichever channel the network uses.
- The **Sensor Node** does NOT connect to WiFi at all, but it must be forced to the same channel. The code hardcodes channel **6** using `esp_wifi_set_channel()`.
- The Logic Node uses `WiFi.channel()` (which returns the channel the router assigned) when registering its peer. **Both must match** or ESP-NOW messages will be lost.

---

## 2. Hardware & Communication Concepts

### 2.1 ESP32

The ESP32 is a small, cheap **microcontroller** (a tiny computer on a single chip). It has built-in **WiFi** and **Bluetooth**. You program it with the Arduino IDE using C/C++. Each ESP32 runs one program that starts with `setup()` (runs once) and then `loop()` (runs forever).

### 2.2 PAJ7620U2 Gesture Sensor

A small infrared sensor that can recognize **9 hand gestures**: up, down, left, right, forward (push toward), backward (pull away), clockwise wave, and counter-clockwise wave. It communicates with the ESP32 over **I²C** (a wiring protocol that uses just two wires: SDA for data and SCL for clock).

### 2.3 ESP-NOW

ESP-NOW is a **peer-to-peer wireless protocol** made by Espressif (the company that makes ESP32). Key properties:

- **No WiFi router needed** — the two ESP32 boards talk directly to each other
- **Very fast** — almost instant, low latency
- **Uses MAC addresses** to identify peers (like phone numbers for devices)
- **Small messages** — max 250 bytes per message
- You register a **callback function** that runs automatically whenever a message arrives
- **Channel-dependent** — both devices must operate on the same WiFi channel

### 2.4 WiFi Channels

WiFi operates on different **channels** (numbered 1–13 in most regions). A channel is a specific frequency band. When the Logic Node connects to a WiFi router, the router tells it which channel to use. The Sensor Node never connects to a router, so it must be **manually forced** to the same channel with `esp_wifi_set_channel()`. If the channels don't match, ESP-NOW packets are sent on one frequency and the other device is listening on a different frequency — like two walkie-talkies set to different channels.

### 2.5 HTTP / REST API

HTTP is the protocol your browser uses to load web pages. A **REST API** is a way for programs (not just browsers) to send and receive data over HTTP using these methods:

| Method | Meaning | Example |
|---|---|---|
| `GET` | "Give me data" | `GET /esp/command` — "Are there any commands for me?" |
| `POST` | "Here is new data" | `POST /auth/result` — "Here is whether the user passed authentication" |

### 2.6 JSON

JSON (JavaScript Object Notation) is a text format for sending structured data. Example:
```json
{ "username": "alice", "gesture_password": [1, 2, 3, 4, 5, 6] }
```
Both the ESP32 (using the ArduinoJson library) and JavaScript (with `JSON.stringify()` and `JSON.parse()`) can read and write JSON.

### 2.7 Polling

**Polling** means repeatedly asking "is there anything new?" at regular intervals. In this project:
- The **Logic Node** polls the server every 2 seconds: "Any new commands?"
- The **Browser** polls the server every 1.5 seconds: "Did the user pass authentication yet?"

This is simpler than "push" notifications (like WebSockets) but uses more network requests.

### 2.8 MAC Address

A **MAC address** is a unique hardware identifier for every network device, like a serial number. Format: `94:B9:7E:D6:4C:00`. In ESP-NOW, you must know the MAC address of the device you want to send messages to. In this project:
- Sensor Node's MAC: `94:B9:7E:D6:4C:00` (stored in logic.txt as `sensorNodeMAC`)
- Logic Node's MAC: `9C:9C:1F:FB:82:1C` (stored in sensor.txt as `logicNodeMAC`)

Each board stores the **other** board's MAC address so it knows where to send messages.

### 2.9 Volatile Keyword

In C/C++, `volatile` tells the compiler: "This variable can be changed by something outside the normal program flow" (like an interrupt or a callback that runs in the background). Without `volatile`, the compiler might optimize the code in a way that ignores the variable changing, causing bugs.

### 2.10 Callback Function

A **callback** is a function you write and then hand over to a library, saying: "Call MY function whenever something happens." For example:
```cpp
esp_now_register_recv_cb(onReceive);  // "Call onReceive() whenever a message arrives"
```
You don't call `onReceive()` yourself — the ESP-NOW system calls it for you automatically.

---

## 3. Sensors & Components — Detailed Hardware Guide

This section explains **every physical component** used in the project — what it is, how it works internally, its pinout, and how it connects to the ESP32.

---

### 3.1 ESP32 Development Board (×2)

#### What it is

The ESP32 is a **microcontroller** — a tiny, low-power computer on a single chip, designed to run one program forever. It is made by **Espressif Systems** (a Chinese semiconductor company). Unlike a full computer, a microcontroller has no operating system, no screen, and no keyboard — it just runs your code in a loop.

The raw ESP32 chip is very small (about 5mm × 5mm), so it's typically mounted on a **development board** (also called a "dev board" or "breakout board") that adds:
- A **USB port** for programming and power
- A **voltage regulator** that converts 5V USB power to the 3.3V the chip needs
- **Pin headers** (the rows of metal pins on the sides) that let you connect wires to the chip's GPIO pins
- A **reset button** and sometimes a **boot button**

#### Key Specifications

| Feature | Detail |
|---|---|
| **Processor** | Dual-core Xtensa LX6, up to 240 MHz |
| **RAM** | 520 KB SRAM |
| **Flash memory** | 4 MB (where your program is stored) |
| **WiFi** | 802.11 b/g/n, 2.4 GHz band |
| **Bluetooth** | v4.2 BR/EDR and BLE |
| **GPIO pins** | Up to 34 general-purpose input/output pins |
| **Operating voltage** | 3.3V (the dev board accepts 5V via USB and regulates it down) |
| **ADC** | 12-bit analog-to-digital converters on some pins |
| **I²C** | Hardware support for I²C protocol (used to talk to the gesture sensor) |
| **SPI** | Hardware support for SPI protocol (not used in this project) |

#### How it works in this project

Two ESP32 boards are used:

| Board | Role | WiFi usage | ESP-NOW usage |
|---|---|---|---|
| **ESP32 #1 (Sensor Node)** | Reads gestures, drives LEDs/buzzer | WiFi radio on but NOT connected to any network (STA mode, disconnected, channel forced to 6) | Sends gesture data to Logic Node, receives ack codes |
| **ESP32 #2 (Logic Node)** | Compares gestures, communicates with web server | Connected to WiFi network "mikhail" for HTTP access to the server | Receives gesture data from Sensor Node, sends ack codes back |

#### GPIO (General Purpose Input/Output)

GPIO pins are the electrical contacts on the ESP32 that you connect wires to. Each pin can be configured as:
- **OUTPUT** — the ESP32 sends voltage out (to turn on an LED, for example)
- **INPUT** — the ESP32 reads voltage in (to detect a button press, for example)

When a pin is set to OUTPUT:
- `HIGH` = 3.3 volts ("on")
- `LOW` = 0 volts / ground ("off")

In the Sensor Node, these GPIOs are used:

| GPIO Pin | Connected to | Direction | Purpose |
|---|---|---|---|
| **GPIO 25** | Red LED (anode) | OUTPUT | Lights up red for auth failure |
| **GPIO 18** | Green LED (anode) | OUTPUT | Lights up green for auth success / password saved |
| **GPIO 27** | Blue LED (anode) | OUTPUT | Lights up blue for create/auth mode active |
| **GPIO 14** | Yellow LED (anode) | OUTPUT | Quick blink for gesture received feedback |
| **GPIO 32** | Buzzer signal (S pin) | OUTPUT | Beeps for feedback |
| **GPIO 21** | PAJ7620 SDA (data) | I²C data | Reads gesture data from sensor |
| **GPIO 22** | PAJ7620 SCL (clock) | I²C clock | Provides clock signal to sensor |

> GPIO 21 and GPIO 22 are the **default I²C pins** on most ESP32 dev boards. The `Wire.begin()` function automatically uses these pins unless you specify different ones.

#### Programming the ESP32

You write code in the **Arduino IDE** (Integrated Development Environment) using C/C++. The Arduino framework provides two mandatory functions:
- **`setup()`** — runs once when the board powers on or resets
- **`loop()`** — runs repeatedly forever after `setup()` finishes

To upload code: connect the ESP32 via USB → select the correct COM port and board type in Arduino IDE → click "Upload." The code is compiled on your computer and flashed to the ESP32's flash memory.

---

### 3.2 PAJ7620U2 Gesture Sensor

#### What it is

The PAJ7620U2 is a **gesture recognition sensor** made by **PixArt Imaging**. It's a small IC (integrated circuit) that uses infrared light to detect hand movements without physical contact. It's typically sold as a small module (breakout board) about the size of a postage stamp.

#### How it works internally

The sensor works using a principle similar to how a computer mouse tracks movement:

1. **Built-in infrared (IR) LED** — the sensor has a tiny IR LED that constantly emits invisible infrared light (wavelength ~850nm). You can't see this light with your eyes, but a camera without an IR filter can.

2. **IR image sensor** — a small array of photodetectors (like a very low-resolution camera) captures reflections of the IR light bouncing off your hand.

3. **On-chip processor** — the PAJ7620U2 has a built-in microprocessor that analyzes the pattern of reflected IR light. By looking at how the bright spot moves across the sensor array over time, it determines which direction your hand moved.

4. **Gesture output** — instead of sending raw image data, the sensor processes everything internally and outputs a simple **gesture code** (a number) via I²C. This makes it very easy to use — you just ask "what gesture happened?" and get back a number.

#### Supported Gestures

| Gesture | Motion | Constant in RevEng_PAJ7620 library |
|---|---|---|
| Up | Hand moves upward | `GES_UP` |
| Down | Hand moves downward | `GES_DOWN` |
| Left | Hand moves left | `GES_LEFT` |
| Right | Hand moves right | `GES_RIGHT` |
| Forward | Hand pushes toward the sensor | `GES_FORWARD` |
| Backward | Hand pulls away from sensor | `GES_BACKWARD` |
| Clockwise | Hand waves in clockwise circle | `GES_CLOCKWISE` |
| Counter-clockwise | Hand waves in counter-clockwise circle | `GES_ANTICLOCKWISE` |
| Wave | Repeated left-right motion | `GES_WAVE` (not used in this project) |

#### Detection Range

| Parameter | Value |
|---|---|
| **Detection distance** | 5–15 cm (about 2–6 inches) from the sensor surface |
| **Detection angle** | ~60° cone in front of the sensor |
| **Response time** | Typically 20–100ms per gesture |
| **Ambient light** | Works in both bright and dark environments (uses its own IR light) |

#### Pinout (Module)

The PAJ7620U2 module typically has 4 pins:

| Pin | Name | Connects to | Purpose |
|---|---|---|---|
| **VCC** | Power | ESP32 3.3V | Provides power to the sensor (operates at 2.8V–3.3V) |
| **GND** | Ground | ESP32 GND | Common ground reference |
| **SDA** | Serial Data | ESP32 GPIO 21 | I²C data line — bidirectional, carries the actual data |
| **SCL** | Serial Clock | ESP32 GPIO 22 | I²C clock line — driven by the ESP32, synchronizes data transfer |

Some modules also have an **INT** (interrupt) pin that pulses when a gesture is detected, but this project uses polling instead (calling `sensor.readGesture()` in the loop).

#### I²C Communication Protocol

I²C (pronounced "I-squared-C" or "I-two-C") is a **serial communication protocol** that allows a microcontroller (the "master") to communicate with one or more sensors/devices (the "slaves") using just **two wires**:

- **SDA (Serial Data)** — carries the actual data bits back and forth
- **SCL (Serial Clock)** — the master sends a clock signal so both sides know when to read/write each bit

Key properties:
- **Addressable** — each I²C device has a unique 7-bit address (the PAJ7620U2's address is `0x73`). Multiple devices can share the same two wires, and the master specifies which device it wants to talk to by sending its address first.
- **Half-duplex** — data can flow in both directions, but only one direction at a time.
- **Pull-up resistors** — the SDA and SCL lines need pull-up resistors (usually built into the module) to work properly. These keep the lines at 3.3V when nobody is driving them low.
- **Speed** — standard mode runs at 100 kHz, fast mode at 400 kHz.

In Arduino, I²C is managed by the `Wire` library:
- `Wire.begin()` — initializes the I²C hardware on the default pins (GPIO 21/22)
- The `RevEng_PAJ7620` library handles all the low-level I²C read/write operations internally

#### Sensor Rotation in This Project

The PAJ7620U2 is physically **mounted rotated 90° clockwise** from its normal orientation. This means the sensor's idea of "up" is actually "left" in the real world. The `readGesture()` function handles this by remapping:

```
Physical (sensor's perspective)  →  Logical (real-world)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
UP                               →  LEFT
DOWN                             →  RIGHT
LEFT                             →  DOWN
RIGHT                            →  UP
FORWARD                          →  FORWARD (unchanged)
BACKWARD                         →  BACKWARD (unchanged)
CLOCKWISE                        →  CLOCKWISE (unchanged)
ANTICLOCKWISE                    →  ANTICLOCKWISE (unchanged)
```

Forward, backward, and rotational gestures are unaffected because they don't depend on the sensor's orientation.

#### RevEng_PAJ7620 Library

The `RevEng_PAJ7620` library is a third-party Arduino library that provides a simple interface to the PAJ7620U2 sensor:

| Function | What it does |
|---|---|
| `sensor.begin()` | Initializes the sensor over I²C. Returns `true` if successful, `false` if the sensor is not detected (wrong wiring). |
| `sensor.readGesture()` | Checks if a gesture has been detected and returns it as a `Gesture` enum value. Returns `GES_NONE` if no gesture. |

---

### 3.3 LEDs (Light Emitting Diodes) (×4)

#### What they are

An **LED** (Light Emitting Diode) is a small electronic component that emits light when electric current flows through it. Unlike a regular light bulb, an LED:
- Uses very little power
- Has a specific color determined by the semiconductor material
- Has polarity — current can only flow in one direction

#### How an LED works

An LED has two legs (leads):
- **Anode (+)** — the longer leg — connect this to the GPIO pin (or to positive voltage)
- **Cathode (−)** — the shorter leg — connect this to ground (GND)

When you set a GPIO pin to `HIGH` (3.3V), current flows from the pin → through the LED → to ground, and the LED lights up. When you set it to `LOW` (0V), no current flows and the LED is off.

#### Current Limiting Resistor

LEDs have very low resistance, so without a **current-limiting resistor** (usually 220Ω–330Ω), too much current would flow and the LED would burn out. The resistor is connected **in series** (in line with) the LED. Most LED modules on breadboards come with a built-in resistor.

#### LEDs in this project

| LED Color | GPIO Pin | Purpose | When it lights up |
|---|---|---|---|
| **Red** | GPIO 25 | ❌ Authentication failure | Solid red for ~1.4 seconds when gestures don't match |
| **Green** | GPIO 18 | ✅ Success indicator | Blinks 3× for auth success; solid for password saved |
| **Blue** | GPIO 27 | 🔵 Mode active indicator | Solid/blinking blue when in Auth or Create mode |
| **Yellow** | GPIO 14 | 🟡 Gesture received feedback | Quick single blink (80ms) for each gesture detected |

#### Arduino functions used with LEDs

```cpp
pinMode(LED_RED, OUTPUT);      // Configure pin as output (done once in setup)
digitalWrite(LED_RED, HIGH);   // Turn LED on (3.3V on the pin)
digitalWrite(LED_RED, LOW);    // Turn LED off (0V on the pin)
```

---

### 4.4 Buzzer Module

#### What it is

A **buzzer** is an electronic component that produces sound. The buzzer module used in this project is an **active buzzer** — meaning it has a built-in oscillator circuit that generates the sound. You just need to supply power (set the pin to HIGH) and it buzzes at a fixed pitch. This is different from a **passive buzzer**, which requires you to send a specific frequency signal.

#### Active vs Passive Buzzer

| Feature | Active Buzzer (used here) | Passive Buzzer |
|---|---|---|
| Built-in oscillator? | Yes | No |
| How to use | Just apply voltage (HIGH/LOW) | Must send a PWM signal at a specific frequency |
| Sound variety | Single fixed tone | Can play different notes/melodies |
| Code complexity | Very simple — `digitalWrite()` | More complex — `tone()` function needed |

#### Buzzer Module Pins

The buzzer module used has three pins:

| Pin | Label | Connects to | Purpose |
|---|---|---|---|
| **S** | Signal | ESP32 GPIO 32 | Control pin — HIGH = buzzer on, LOW = buzzer off |
| **VCC** | Power | ESP32 3.3V | Provides operating power to the module |
| **−** (GND) | Ground | ESP32 GND | Common ground reference |

> The signal pin (S) is connected to GPIO 32 because not all ESP32 GPIOs support all functions. GPIO 32 is a good general-purpose output pin.

#### How it's used in code

```cpp
pinMode(BUZZER, OUTPUT);        // Configure pin as output (done once in setup)
digitalWrite(BUZZER, HIGH);     // Buzzer ON (starts buzzing)
digitalWrite(BUZZER, LOW);      // Buzzer OFF (stops buzzing)
```

The `beep()` helper function turns it on, waits, then turns it off:
```cpp
void beep(int ms) {
  buzzerOn();   // HIGH
  delay(ms);    // Wait 'ms' milliseconds
  buzzerOff();  // LOW
}
```

#### Buzzer feedback patterns

| Situation | Sound pattern |
|---|---|
| Gesture detected | 60ms short beep |
| Password saved (create mode complete) | 400ms long beep |
| Auth success | Two quick 100ms beeps with 80ms gap |
| Auth failure | 800ms continuous buzz |

---

### 4.5 Breadboard & Jumper Wires

#### Breadboard

A **breadboard** is a plastic board with many small holes arranged in a grid. Inside the board, the holes are connected in rows by metal strips, so you can plug components and wires into the holes to create circuits **without soldering**.

The typical breadboard layout:
- **Terminal strips** (the main area): holes in the same row are connected horizontally (in groups of 5)
- **Power rails** (the long strips on the sides): holes in the same column are connected vertically — typically used for VCC (3.3V or 5V) and GND
- A **center gap** separates the two halves — components like IC chips straddle this gap

#### Jumper Wires

**Jumper wires** are short, flexible wires with pin connectors on each end, used to connect components on a breadboard. They come in three types:
- **Male-to-Male (M-M)** — pin on both ends, used for breadboard-to-breadboard connections
- **Male-to-Female (M-F)** — pin on one end, socket on the other, used for breadboard-to-module connections
- **Female-to-Female (F-F)** — socket on both ends, used for module-to-module connections

---

### 3.6 Complete Wiring Diagram (Sensor Node)

Here is how all components connect to ESP32 #1 (the Sensor Node):

```
                    ESP32 Dev Board
                   ┌──────────────────┐
                   │                  │
   PAJ7620 SDA ────┤ GPIO 21 (SDA)    │
   PAJ7620 SCL ────┤ GPIO 22 (SCL)    │
                   │                  │
    Red LED (+) ───┤ GPIO 25          │
  Green LED (+) ───┤ GPIO 18          │
   Blue LED (+) ───┤ GPIO 27          │
 Yellow LED (+) ───┤ GPIO 14          │
                   │                  │
    Buzzer (S) ────┤ GPIO 32          │
                   │                  │
   PAJ7620 VCC ────┤ 3.3V             │
   Buzzer VCC  ────┤ 3.3V             │
                   │                  │
   PAJ7620 GND ────┤ GND              │
    Buzzer GND ────┤ GND              │
  All LED (−)  ────┤ GND              │
                   │                  │
                   └──────────────────┘
```

- All LED cathodes (−) connect to GND (through current-limiting resistors)
- The PAJ7620 and buzzer module both share the 3.3V and GND rails
- The Logic Node (ESP32 #2) has **no external components** — it just connects to power via USB and communicates wirelessly

---

### 3.7 Power Supply

Both ESP32 boards are powered via their **micro-USB** (or USB-C) port:
- When connected to a computer: powered via USB (5V) and can also be programmed
- When deployed: powered by a USB power bank or USB wall adapter
- The on-board **voltage regulator** converts 5V USB power down to **3.3V** for the chip and all connected components

> **Important**: All components in this project run at **3.3V**. The ESP32's GPIO pins output 3.3V when HIGH. The PAJ7620U2 and the buzzer module both accept 3.3V power. The LEDs are driven through current-limiting resistors from 3.3V GPIO pins. Do NOT connect 5V directly to the ESP32's GPIO pins — this can damage the chip.

---

## 4. File-by-File Breakdown

---

### 4.1 `sensor.txt` — ESP32 Sensor Node (Arduino)

**Purpose**: This ESP32 sits next to the physical gesture sensor. It reads hand gestures, provides LED/buzzer feedback, and sends gesture data to the Logic Node via ESP-NOW.

#### 4.1.1 Includes (Libraries)

```cpp
#include <Wire.h>         // I²C communication library (to talk to the gesture sensor)
#include <WiFi.h>         // WiFi library (needed to set STA mode for ESP-NOW)
#include <esp_now.h>      // ESP-NOW library (peer-to-peer wireless messaging)
#include <esp_wifi.h>     // Low-level WiFi functions (for esp_wifi_set_channel)
#include "RevEng_PAJ7620.h"  // Driver library for the PAJ7620U2 gesture sensor
```

- `#include` is a **preprocessor directive** — it copies the entire contents of the named file (a library) into your code before compilation. Think of it like importing a toolbox.
- `<angle brackets>` means it's a system/installed library. `"quotes"` means it's a local file in your project folder.
- `<esp_wifi.h>` is included specifically for the `esp_wifi_set_channel()` function, which forces the ESP32 to a specific WiFi channel. This is a **low-level ESP-IDF function** (ESP-IDF is the core framework underneath Arduino for ESP32).

#### 4.1.2 Object Creation

```cpp
RevEng_PAJ7620 sensor = RevEng_PAJ7620();
```

This creates an **object** named `sensor` from the `RevEng_PAJ7620` **class**. A class is like a blueprint, and an object is a specific instance built from that blueprint. Here, `sensor` represents the physical gesture sensor and gives us functions like `sensor.begin()` and `sensor.readGesture()`.

#### 4.1.3 Pin Definitions

```cpp
#define LED_RED    25
#define LED_GREEN  18
#define LED_BLUE   27
#define LED_YELLOW 14
#define BUZZER     32
```

`#define` is a **preprocessor macro** — it does a "find and replace" before compilation. Everywhere the compiler sees `LED_RED`, it replaces it with `25`. GPIO 25, 18, etc. are **General Purpose Input/Output** pin numbers on the ESP32 board. These pins connect to physical LEDs and a buzzer.

#### 4.1.4 MAC Address of the Logic Node

```cpp
uint8_t logicNodeMAC[] = {0x94, 0xB9, 0x7E, 0xD6, 0x4C, 0x00};
```

- `uint8_t` — an **unsigned 8-bit integer** (stores 0–255). The "u" means unsigned (no negatives), "8" means 8 bits, "t" means it's a type.
- `0x94` — the `0x` prefix means **hexadecimal** (base 16). `94` in hex = 148 in decimal.
- This is the MAC address of the other ESP32 (the Logic Node). ESP-NOW needs this to know *where* to send messages.
- Notice: this MAC (`94:B9:7E:D6:4C:00`) matches the MAC stored in `logic.txt`'s own `sensorNodeMAC` — each board stores the **other** board's address.

#### 4.1.5 Gesture Code Definitions

```cpp
#define G_NONE     0
#define G_UP       1
#define G_DOWN     2
#define G_LEFT     3
#define G_RIGHT    4
#define G_FORWARD  5
#define G_BACKWARD 6
#define G_CW       7
#define G_CCW      8
```

Each gesture is assigned a **numeric code**. This is easier to send wirelessly than text strings. When the sensor detects "hand moved right," we convert that to the number `4` before transmitting.

#### 4.1.6 Message Struct

```cpp
typedef struct {
  uint8_t type;     // message type (always 0 in this project)
  uint8_t gesture;  // the gesture code (1–8)
  uint8_t cmd;      // command code: 0=enter create, 1=enter auth, 2=gesture data
} Message;
```

A **struct** (structure) is a custom data type that groups related variables together. Think of it like a labeled envelope:
- `type` — what kind of message (reserved, always 0 here)
- `gesture` — which gesture was detected
- `cmd` — what action to take

`typedef` lets us use `Message` as a type name (instead of writing `struct Message` every time).

#### 4.1.7 State Machine (Enum)

```cpp
enum State { IDLE, CREATE_MODE, AUTH_MODE };
volatile State currentState = IDLE;
```

An **enum** (enumeration) defines a set of named constants. Behind the scenes, `IDLE = 0`, `CREATE_MODE = 1`, `AUTH_MODE = 2`. This is a **state machine** — the ESP32 can only be in one of these states at a time, and different code runs depending on the current state:

| State | What the sensor does when it detects a gesture |
|---|---|
| `IDLE` | Listens for the activation trigger sequence or an auth wake gesture |
| `CREATE_MODE` | Sends each gesture to the Logic Node (6 gestures = new password) |
| `AUTH_MODE` | Sends each gesture to the Logic Node (6 gestures = attempt to log in) |

`volatile` is used because `currentState` can be changed inside the `onReceive` callback (which runs at interrupt-level, asynchronously).

#### 4.1.8 Trigger Sequence

```cpp
const uint8_t TRIGGER[] = {G_RIGHT, G_RIGHT, G_LEFT};
#define TRIGGER_LEN 3
uint8_t triggerIdx = 0;
```

To enter CREATE_MODE from the physical sensor, the user must perform a specific sequence: **Right → Right → Left**. `triggerIdx` tracks how far through the sequence the user has progressed. If they get the next gesture wrong, `triggerIdx` resets to 0.

`const` means this array cannot be changed after being set — it's a constant.

#### 4.1.9 Auth Wake Gesture

```cpp
#define AUTH_WAKE G_UP
```

To enter AUTH_MODE from the physical sensor, the user performs one **UP** gesture. This is simpler than the create trigger because authentication is more common.

#### 4.1.10 Server-Triggered Mode Flags

```cpp
volatile bool enterAuthFromServer   = false;
volatile bool enterCreateFromServer = false;
```

These **boolean flags** (`bool` = true or false) are set inside the `onReceive` callback when the Logic Node tells the Sensor Node to change mode. They are `volatile` because they're modified in a callback.

The reason we use flags instead of changing the state directly in the callback is that the callback should be **fast and short** — doing heavy work (like LED animations) inside callbacks can cause problems.

#### 4.1.11 `onReceive()` — ESP-NOW Receive Callback

```cpp
void onReceive(const esp_now_recv_info_t *info, const uint8_t *data, int len) {
  if (len >= 1) {
    uint8_t code = data[0];
    if (code == 0 && currentState == IDLE)      enterCreateFromServer = true;
    else if (code == 1 && currentState == IDLE)  enterAuthFromServer = true;
    else if (code >= 2)                          lastAck = code;
  }
}
```

This function is **automatically called by the ESP-NOW system** whenever a message arrives from the Logic Node.

- `const esp_now_recv_info_t *info` — a **pointer** to information about who sent the message. A pointer (`*`) holds the memory address of data rather than the data itself. `const` means we can read it but not modify it.
- `const uint8_t *data` — a pointer to the raw bytes of the received message.
- `int len` — how many bytes were received.

**What the codes mean:**

| Code received from Logic Node | Action |
|---|---|
| `0` | Enter Create mode (the server wants us to capture a new password) |
| `1` | Enter Auth mode (the server wants us to capture a login attempt) |
| `2` | Auth success acknowledgment |
| `3` | Auth failure acknowledgment |

#### 4.1.12 `readGesture()` — Gesture Reading with Rotation Remap

```cpp
uint8_t readGesture() {
  Gesture raw = sensor.readGesture();
  switch (raw) {
    case GES_UP:            return G_LEFT;
    case GES_DOWN:          return G_RIGHT;
    // ... etc
    default:                return G_NONE;
  }
}
```

The physical sensor is **mounted rotated 90° clockwise**, so the raw gesture directions don't match the logical directions. This function remaps them:
- Physical UP → Logical LEFT
- Physical DOWN → Logical RIGHT
- Physical LEFT → Logical DOWN
- Physical RIGHT → Logical UP

A `switch` statement is like a series of `if-else` checks but cleaner for comparing one value against many options. Each `case` is a possible value; `break` or `return` exits the switch. `default` runs if none of the cases match.

#### 4.1.13 LED & Buzzer Helper Functions

```cpp
void allLedsOff() { ... }          // Turn off all 4 LEDs
void buzzerOn()  { ... }           // Turn buzzer on
void buzzerOff() { ... }           // Turn buzzer off
void beep(int ms) { ... }          // Buzz for a specified number of milliseconds
void blinkLed(int pin, int times, int ms) { ... }  // Blink an LED a number of times
void feedbackGestureReceived() { ... }  // Quick yellow blink + short beep
void feedbackCreateMode() { ... }       // Blue LED blinks, then stays on
void feedbackSaved() { ... }            // Green LED + long beep
void feedbackAuthMode() { ... }         // Solid blue LED
void feedbackAuthSuccess() { ... }      // Green blinks + double beep
void feedbackAuthFail() { ... }         // Red LED + long buzz
```

These are **helper functions** — small, reusable functions that do one specific thing. They use:

- `digitalWrite(pin, HIGH/LOW)` — sets a GPIO pin to high (3.3V = on) or low (0V = off). This is a core Arduino function.
- `delay(ms)` — pauses the entire program for `ms` milliseconds. While delayed, no other code can run (this is called **blocking**).
- `pinMode(pin, OUTPUT)` — configures a GPIO pin to be an output (so you can send voltage out of it). Called once in `setup()`.

#### 4.1.14 `sendMessage()` — Sending ESP-NOW Messages

```cpp
void sendMessage(uint8_t type, uint8_t gesture, uint8_t cmd) {
  Message msg = {type, gesture, cmd};
  esp_now_send(logicNodeMAC, (uint8_t*)&msg, sizeof(msg));
}
```

- `Message msg = {type, gesture, cmd};` — creates a `Message` struct and fills in its three fields.
- `(uint8_t*)&msg` — this is a **type cast**. `&msg` gets the memory address of `msg` (a pointer). `(uint8_t*)` tells the compiler to treat that pointer as "a pointer to raw bytes." ESP-NOW sends raw bytes, so we need to convert our struct into raw bytes.
- `sizeof(msg)` — returns the size of the struct in bytes (3 bytes here, one per field). `sizeof` is a compile-time **operator** that tells you how much memory something occupies.

#### 4.1.15 `setup()` — Initialization

```cpp
void setup() {
  Serial.begin(115200);           // Start serial communication at 115200 baud rate
  Wire.begin();                   // Start I²C bus (for the gesture sensor)
  sensor.begin();                 // Initialize the gesture sensor

  // Set pin modes and turn everything off
  pinMode(LED_RED, OUTPUT);
  // ... etc

  WiFi.mode(WIFI_STA);           // Set WiFi to Station mode (required for ESP-NOW)
  WiFi.disconnect();              // Don't connect to any WiFi network

  // Force WiFi channel to 6 (must match Logic Node's channel)
  esp_wifi_set_channel(6, WIFI_SECOND_CHAN_NONE);

  esp_now_init();                 // Initialize ESP-NOW
  esp_now_register_recv_cb(onReceive);  // Register our callback

  // Register the Logic Node as a peer
  esp_now_peer_info_t peer = {};
  memcpy(peer.peer_addr, logicNodeMAC, 6);
  peer.channel = 6;              // Hardcoded to channel 6
  peer.encrypt = false;
  esp_now_add_peer(&peer);
}
```

Key concepts:

- `Serial.begin(115200)` — starts the **serial port** at 115200 bits per second. Serial is used for debugging — you can see printed messages in the Arduino IDE's Serial Monitor. `115200` is the **baud rate** (speed of communication).
- `WiFi.mode(WIFI_STA)` — sets the ESP32 to **Station (STA) mode**. Even though the Sensor Node never connects to a WiFi network, ESP-NOW requires WiFi hardware to be in STA mode to work.
- `WiFi.disconnect()` — explicitly tells the ESP32 NOT to connect to any WiFi network. The Sensor Node only uses ESP-NOW, not internet WiFi. This call ensures the chip isn't trying to join a network in the background.
- **`esp_wifi_set_channel(6, WIFI_SECOND_CHAN_NONE)`** — this is a **critical line**. It forces the ESP32's radio to operate on WiFi **channel 6**. The second argument `WIFI_SECOND_CHAN_NONE` means "don't use a secondary channel" (some WiFi modes use two channels for extra bandwidth, but ESP-NOW doesn't need this). This channel MUST match the channel the Logic Node's WiFi router is using, otherwise the two ESP32s will be transmitting/listening on different frequencies and cannot communicate.
- `memcpy(destination, source, numBytes)` — **memory copy**. Copies `numBytes` bytes from `source` to `destination`. Here it copies the MAC address into the peer info structure.
- `esp_now_peer_info_t peer = {}` — creates a peer info structure and **zero-initializes** it (all fields set to 0). The `= {}` syntax fills every byte with zero.
- `peer.channel = 6` — hardcoded to channel 6, matching the `esp_wifi_set_channel` call above.
- `peer.encrypt = false` — don't encrypt the messages (simpler but less secure).

#### 4.1.16 `loop()` — Main Loop

The `loop()` function runs **forever**, over and over. Here's what it does each cycle:

**Step 1: Check server-triggered mode changes**
```cpp
if (currentState == IDLE && enterAuthFromServer) {
    enterAuthFromServer = false;
    currentState = AUTH_MODE;
    feedbackAuthMode();
}
// Similar for enterCreateFromServer
```
If the Logic Node (via the server) told us to change modes, we do so now (not in the callback, for safety).

**Step 2: Read a gesture**
```cpp
uint8_t g = readGesture();
if (g == G_NONE) { delay(50); return; }
```
If no gesture detected, wait 50ms and skip the rest of the loop. `return` inside `loop()` immediately starts the next loop cycle.

**Step 3: Handle the gesture depending on current state**

Uses a `switch (currentState)` to run different logic:

- **IDLE**: Check if the gesture matches the trigger sequence (for Create Mode) or the auth wake gesture (for Auth Mode).
- **CREATE_MODE**: Send each gesture to the Logic Node. After 6 gestures, return to IDLE.
- **AUTH_MODE**: Send each gesture to the Logic Node. After 6 gestures, **wait up to 1 second** for an ack code (success/fail), then show the appropriate feedback.

```cpp
unsigned long t = millis();
while (lastAck == 0 && millis() - t < 1000) delay(10);
```

`millis()` returns how many milliseconds have passed since the ESP32 booted. This creates a **non-blocking timeout**: keep checking `lastAck` every 10ms, but give up after 1 second.

---

### 4.2 `logic.txt` — ESP32 Logic Node (Arduino)

**Purpose**: This ESP32 is the "brain." It connects to WiFi, polls the web server for commands, receives gesture data from the Sensor Node via ESP-NOW, compares gestures against stored passwords, and reports results back to the server.

#### 4.2.1 Includes (Libraries)

```cpp
#include <WiFi.h>          // WiFi library for connecting to a router
#include <esp_now.h>       // ESP-NOW for peer-to-peer communication
#include <esp_wifi.h>      // Low-level WiFi functions (channel management)
#include <HTTPClient.h>    // HTTP client to make web requests (GET, POST)
#include <ArduinoJson.h>   // JSON parsing and creation library
```

`HTTPClient.h` is an Arduino library that makes HTTP requests easy — similar to how `fetch()` works in JavaScript. `ArduinoJson.h` is a third-party library (installed via the Arduino Library Manager) for parsing JSON text into usable C++ data structures.

#### 4.2.2 Configuration Constants

```cpp
const char* WIFI_SSID     = "mikhail";
const char* WIFI_PASSWORD = "password";
const char* SERVER_URL    = "https://gesture-authentication-website-1.onrender.com";
const char* ESP_SECRET    = "ily33";
```

- `const char*` — a **pointer to a constant character** — this is how C/C++ represents text strings. The `const` means the string contents cannot be changed.
- `WIFI_SSID` / `WIFI_PASSWORD` — the WiFi network name and password to connect to.
- `SERVER_URL` — the URL of the Node.js server (hosted on Render).
- `ESP_SECRET` — a shared secret that the ESP32 sends in every HTTP request. The server checks this to verify the request is actually from the ESP32 and not a random person.

#### 4.2.3 Sensor Node MAC Address

```cpp
uint8_t sensorNodeMAC[] = {0x9C, 0x9C, 0x1F, 0xFB, 0x82, 0x1C};
```

This is the MAC address of the Sensor Node (ESP32 #1). The Logic Node needs this to send ESP-NOW messages back to the sensor (like ack codes). Notice this matches the MAC the Sensor Node would print with `WiFi.macAddress()`.

#### 4.2.4 State Variables

```cpp
uint8_t inputBuffer[6] = {0};    // stores the 6 gestures the user performs during auth
uint8_t bufferIdx      = 0;      // how many gestures have been received so far

uint8_t fetchedPassword[6] = {0}; // the correct password fetched from the server
bool    hasFetchedPassword  = false;  // whether we have a password to compare against

String  pendingToken    = "";     // the unique auth session token
String  pendingUsername = "";     // who is trying to log in
bool    sessionActive   = false;  // is there an active login attempt?

bool    createModeActive = false; // are we capturing a new password?
String  createUsername   = "";    // who is the new password for?
uint8_t newGestures[6]  = {0};   // the 6 gestures for the new password
uint8_t createIdx        = 0;    // how many create gestures received so far

enum Mode { MODE_IDLE, MODE_CREATE, MODE_AUTH };
Mode currentMode = MODE_IDLE;
```

`String` (capital S) is the Arduino String class — a convenient way to handle text that can grow and shrink (unlike `char*` which has a fixed size). It behaves similarly to strings in JavaScript or Python.

#### 4.2.5 Deferred HTTP Flags

```cpp
volatile bool authResultReady    = false;
volatile bool authResultSuccess  = false;
volatile bool createResultReady  = false;
```

**Why deferred?** The `onReceive()` callback runs at **interrupt level** — it needs to finish quickly. Making HTTP requests inside a callback would take too long and could crash the ESP32. Instead, the callback sets a flag, and the `loop()` function checks it and makes the HTTP call when it's safe.

This is a common pattern called **deferred execution** or **flag-based asynchronous processing**.

#### 4.2.6 `onSend()` — ESP-NOW Send Callback

```cpp
void onSend(const wifi_tx_info_t *tx_info, esp_now_send_status_t status) {
  lastSendOk = (status == ESP_NOW_SEND_SUCCESS);
}
```

Called automatically **after** an ESP-NOW message is sent. It tells us whether the message was delivered successfully.

- `const wifi_tx_info_t *tx_info` — a **pointer** to a structure containing WiFi transmission details (like signal strength, retry count, etc.). This is a newer ESP-IDF callback signature. The `const` means we can read the info but cannot modify it. In this code we don't actually use this parameter — we only care about the `status`.
- `esp_now_send_status_t status` — an **enum type** defined by the ESP-NOW library. It will be either `ESP_NOW_SEND_SUCCESS` or `ESP_NOW_SEND_FAIL`.

#### 4.2.7 `sendAck()` — Send Acknowledgment with Retry

```cpp
void sendAck(uint8_t code) {
  for (int attempt = 0; attempt < 3; attempt++) {
    lastSendOk = false;
    esp_err_t result = esp_now_send(sensorNodeMAC, &code, 1);
    // ... wait for callback, retry if failed
  }
}
```

This sends a **1-byte acknowledgment** to the Sensor Node. What makes it robust is the **retry logic**: it tries up to 3 times, waiting 200ms each time for the send callback to confirm delivery.

| Ack code | Meaning |
|---|---|
| `0` | "Enter Create Mode" (sensor should start capturing gestures) |
| `1` | "Enter Auth Mode" (sensor should start capturing gestures) |
| `2` | "Auth Successful" (correct password) |
| `3` | "Auth Failed" (wrong password) |
| `4` | "Password Captured" (create flow complete) |

`esp_err_t` is an **error type** from the ESP-IDF framework. `ESP_OK` means "no error."

#### 4.2.8 `onReceive()` — ESP-NOW Receive Callback

```cpp
void onReceive(const esp_now_recv_info_t *info, const uint8_t *data, int len) {
  if (len < sizeof(Message)) return;
  Message msg;
  memcpy(&msg, data, sizeof(msg));
  // ...
}
```

- `memcpy(&msg, data, sizeof(msg))` — copies the raw bytes from `data` into our `Message` struct. This is the reverse of what happens in `sendMessage()` on the Sensor Node. `&msg` means "the address of msg."

**When `msg.cmd == 2` (gesture data arrives):**

- **In AUTH mode**: Add the gesture to `inputBuffer`. When 6 gestures are collected, **compare them to `fetchedPassword`**:
  ```cpp
  bool match = true;
  for (int i = 0; i < 6; i++) {
    if (inputBuffer[i] != fetchedPassword[i]) { match = false; break; }
  }
  ```
  This is a simple **array comparison** — check each element one by one. If any element differs, it's a mismatch. Then send ack `2` (success) or `3` (fail) to the Sensor Node, and set `authResultReady = true` so the loop can POST the result to the server.

- **In CREATE mode**: Add the gesture to `newGestures`. When 6 gestures are collected, set `createResultReady = true` so the loop can POST the new password to the server.

#### 4.2.9 `connectWiFi()` — WiFi Connection

```cpp
void connectWiFi() {
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(500);
    attempts++;
  }
}
```

- `WiFi.begin()` — starts connecting to the WiFi network. This is **asynchronous** — it takes several seconds.
- `WiFi.status()` — returns the current WiFi status. `WL_CONNECTED` means successfully connected.
- The `while` loop waits up to 10 seconds (20 attempts × 500ms) for a connection.
- `WiFi.localIP()` — returns the IP address assigned to the ESP32 by the router.
- `WiFi.channel()` — returns which WiFi channel (1–13) the ESP32 is using. This is critically important because the Sensor Node must be set to the same channel for ESP-NOW to work.

#### 4.2.10 `pollForCommand()` — Polling the Server

```cpp
void pollForCommand() {
  if (WiFi.status() != WL_CONNECTED) return;

  HTTPClient http;
  String url = String(SERVER_URL) + "/esp/command";
  http.begin(url);
  http.addHeader("X-ESP-Secret", ESP_SECRET);

  int code = http.GET();
  if (code == 200) {
    String body = http.getString();

    StaticJsonDocument<256> doc;
    deserializeJson(doc, body);

    if (doc["none"] == true) return;

    const char* cmd = doc["cmd"];
    if (strcmp(cmd, "auth") == 0) {
      // handle auth command
    } else if (strcmp(cmd, "create") == 0) {
      // handle create command
    }
  }
  http.end();
}
```

Key concepts:

- **`HTTPClient http;`** — creates an HTTP client object. This is similar to `fetch()` in JavaScript.
- **`http.begin(url)`** — initializes the request with a URL.
- **`http.addHeader("X-ESP-Secret", ESP_SECRET)`** — adds a custom HTTP header. Headers are metadata sent with every HTTP request. The server checks this header to verify the request is from the ESP32.
- **`http.GET()`** — sends a GET request. Returns an **HTTP status code** (200 = OK, 404 = not found, 500 = server error).
- **`http.getString()`** — gets the response body as a String.
- **`http.end()`** — closes the connection (important to free memory!).

**JSON Parsing with ArduinoJson:**

- **`StaticJsonDocument<256> doc;`** — allocates 256 bytes on the **stack** (fast memory) for parsing JSON. `StaticJsonDocument` is a "container" that holds parsed JSON data.
- **`deserializeJson(doc, body)`** — parses the JSON string `body` and stores the result in `doc`. "Deserialize" means converting from text back into structured data.
- **`doc["cmd"]`** — accesses a field in the parsed JSON, just like `data.cmd` in JavaScript.
- **`strcmp(cmd, "auth")`** — **String Compare** function from C. It returns `0` if the two strings are identical. (C/C++ can't compare strings with `==` like JavaScript can — `==` would compare memory addresses, not contents.)

#### 4.2.11 `fetchPasswordFromServer()` — Get Stored Password

```cpp
void fetchPasswordFromServer(String username) {
  HTTPClient http;
  String url = String(SERVER_URL) + "/user/password?username=" + username;
  http.begin(url);
  http.addHeader("X-ESP-Secret", ESP_SECRET);

  int code = http.GET();
  if (code == 200) {
    // Parse JSON response
    JsonArray arr = doc["gesture_password"].as<JsonArray>();
    if (arr.size() == 6) {
      for (int i = 0; i < 6; i++) fetchedPassword[i] = arr[i];
      hasFetchedPassword = true;
      currentMode = MODE_AUTH;
      sendAck(1);  // tell sensor to enter AUTH mode
    }
  }
}
```

- **`doc["gesture_password"].as<JsonArray>()`** — the `.as<JsonArray>()` is a **template function call**. The `<JsonArray>` inside the angle brackets tells the function what type to convert the value to. This is a C++ feature called **templates** (also known as generics in other languages).
- **Query parameter**: The `?username=alice` in the URL is a **query string** — a way to pass data in a GET request. The server reads it with `req.query.username`.

#### 4.2.12 `postAuthResult()` — Report Auth Result to Server

```cpp
void postAuthResult(bool success) {
  HTTPClient http;
  String url = String(SERVER_URL) + "/auth/result";
  http.begin(url);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-ESP-Secret", ESP_SECRET);

  String body = "{\"token\":\"" + pendingToken + "\",\"success\":" + (success ? "true" : "false") + "}";
  int code = http.POST(body);
}
```

- **`http.POST(body)`** — sends a POST request with the given body. POST is used when you're sending data *to* the server (unlike GET which just requests data).
- **`Content-Type: application/json`** — this header tells the server that the body is JSON formatted.
- **`success ? "true" : "false"`** — this is the **ternary operator**. It's a shorthand for if-else: `condition ? valueIfTrue : valueIfFalse`.
- The body is manually constructed as a JSON string using **string concatenation** (`+` operator on Strings).

#### 4.2.13 `postNewPassword()` — Save New Gesture Password

```cpp
void postNewPassword() {
  String body = "{\"username\":\"" + createUsername + "\",\"gestures\":[";
  for (int i = 0; i < 6; i++) {
    body += newGestures[i];
    if (i < 5) body += ",";
  }
  body += "]}";
  http.POST(body);
}
```

Builds a JSON string like: `{"username":"alice","gestures":[1,3,2,4,5,6]}` by looping through the `newGestures` array.

#### 4.2.14 `setup()` — Initialization

```cpp
void setup() {
  Serial.begin(115200);
  delay(3000);

  // 1. Set STA mode, then connect to WiFi
  WiFi.mode(WIFI_STA);
  connectWiFi();

  // 2. Init ESP-NOW
  esp_now_init();
  esp_now_register_send_cb(onSend);
  esp_now_register_recv_cb(onReceive);

  // 3. Register sensor as peer — use WiFi.channel() for the peer channel
  esp_now_peer_info_t peer = {};
  memcpy(peer.peer_addr, sensorNodeMAC, 6);
  peer.channel = WiFi.channel();  // dynamically use the router's channel
  peer.encrypt = false;
  esp_now_add_peer(&peer);
}
```

Key differences from the Sensor Node:

1. **Connects to WiFi** — because the Logic Node needs internet access to talk to the server.
2. **Registers both send and receive callbacks** — the Sensor Node only registers a receive callback.
3. **`peer.channel = WiFi.channel()`** — uses the **dynamic** channel assigned by the WiFi router. This is different from the Sensor Node which hardcodes channel 6. After `connectWiFi()` completes, `WiFi.channel()` returns the actual channel the router is using (e.g., 6). The Sensor Node must be hardcoded to the same value.
4. Registers the **Sensor Node** as its ESP-NOW peer (instead of the Logic Node).

#### 4.2.15 `loop()` — Main Loop

```cpp
void loop() {
  // 1. Reconnect WiFi if dropped
  if (WiFi.status() != WL_CONNECTED) connectWiFi();

  // 2. Handle deferred auth result
  if (authResultReady) {
    authResultReady = false;
    postAuthResult(authResultSuccess);
    // clean up session
  }

  // 3. Handle deferred create result
  if (createResultReady) {
    createResultReady = false;
    postNewPassword();
  }

  // 4. Poll server for new commands (only when idle)
  if (currentMode == MODE_IDLE && !sessionActive) {
    if (now - lastPollTime >= POLL_INTERVAL_MS) {
      lastPollTime = now;
      pollForCommand();
    }
  }

  delay(100);
}
```

The loop has four responsibilities:
1. **Keep WiFi alive** — automatically reconnect if the connection drops
2. **Deferred auth result** — if the callback set `authResultReady`, POST the result now
3. **Deferred create result** — if the callback set `createResultReady`, POST the password now
4. **Poll for commands** — every 2 seconds, ask the server if there's work to do

---

### 4.3 `server.js` — Node.js Backend

**Purpose**: A web server built with Express.js that serves the frontend pages, manages users and grades in a PostgreSQL database, and acts as the **middleman** between the browser and the ESP32.

#### 4.3.1 Imports and Setup

```javascript
const express = require('express');
const session = require('express-session');
const { Pool } = require('pg');
const path = require('path');
const crypto = require('crypto');
```

- **`require()`** — Node.js's way of importing modules (libraries). Similar to `#include` in C++.
- **`express`** — a web framework that makes it easy to create HTTP servers with routes.
- **`express-session`** — middleware that adds **sessions** (a way to remember who a user is across multiple requests, using cookies).
- **`{ Pool }`** — the `{ }` is **destructuring** — it extracts just the `Pool` class from the `pg` (PostgreSQL) module. `Pool` manages a pool of database connections.
- **`path`** — Node.js built-in module for file path operations.
- **`crypto`** — Node.js built-in module for cryptographic functions (here, generating random UUIDs).

```javascript
const app = express();
const PORT = process.env.PORT || 3000;
```

- `express()` creates the Express **application** object.
- `process.env.PORT` — reads the `PORT` **environment variable**. On Render (the hosting platform), the port is set automatically. `||` means "or" — if `PORT` isn't set, use `3000`.

#### 4.3.2 Database Pool

```javascript
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('localhost')
    ? { rejectUnauthorized: false }
    : false,
});
```

A **connection pool** keeps several database connections open and reuses them (rather than opening/closing a connection for every query). The `ssl` setting enables encrypted connections when using a remote database (like on Render) but disables it for localhost development.

#### 4.3.3 Middleware

```javascript
app.use(express.json());                        // Parse JSON request bodies
app.use(express.urlencoded({ extended: true })); // Parse form-encoded request bodies
app.use(session({ ... }));                       // Enable session management
app.use(express.static(path.join(__dirname, 'public'))); // Serve static files
```

**Middleware** are functions that run on every request *before* your route handlers. Think of them as a processing pipeline:

```
Request → [json parser] → [url parser] → [session] → [static files] → [your route handler] → Response
```

- **`express.json()`** — automatically parses `Content-Type: application/json` request bodies into `req.body`.
- **`express.static('public')`** — serves files from the `public/` folder. When a browser requests `/login.html`, Express looks for `public/login.html` and sends it back.
- **`__dirname`** — a Node.js global variable that holds the absolute path of the current file's directory.
- **Session config**:
  - `secret` — used to sign the session cookie (prevents tampering)
  - `resave: false` — don't save the session if nothing changed
  - `saveUninitialized: false` — don't create a session until something is stored in it
  - `cookie: { maxAge: ... }` — the session cookie expires after 2 hours

#### 4.3.4 `requireEspSecret()` — ESP Secret Middleware

```javascript
function requireEspSecret(req, res, next) {
  if (req.headers['x-esp-secret'] !== ESP_SECRET) {
    return res.status(403).json({ error: 'Invalid ESP secret' });
  }
  next();
}
```

This is a **custom middleware function**. It checks the `X-ESP-Secret` header:
- If it doesn't match → responds with **403 Forbidden** and stops
- If it matches → calls `next()` which passes the request to the next middleware or route handler

This protects ESP-specific routes from being accessed by random users.

- `req` — the **Request** object (contains headers, body, query params, etc.)
- `res` — the **Response** object (used to send data back to the client)
- `next` — a function that means "I'm done, pass to the next handler"
- `req.headers['x-esp-secret']` — accesses the `x-esp-secret` HTTP header (headers are case-insensitive, but Node.js lowercases them)

#### 4.3.5 `initDB()` — Database Initialization

```javascript
async function initDB() {
  await pool.query(`CREATE TABLE IF NOT EXISTS users ( ... )`);
  await pool.query(`CREATE TABLE IF NOT EXISTS grades ( ... )`);
  await pool.query(`CREATE TABLE IF NOT EXISTS esp_commands ( ... )`);
  // Seed admin if not exists
}
```

- **`async`** — marks this function as **asynchronous** (it can "wait" for slow operations like database queries without blocking the server).
- **`await`** — pauses execution until the **Promise** resolves. A Promise is JavaScript's way of handling operations that take time (like database queries or web requests). Without `await`, the code would continue running before the query finishes.
- **`pool.query()`** — sends a SQL query to the PostgreSQL database.
- **`CREATE TABLE IF NOT EXISTS`** — creates the table only if it doesn't already exist (prevents errors on restart).

**The `esp_commands` table** is the core of ESP ↔ website communication:

| Column | Purpose |
|---|---|
| `cmd` | `"auth"` or `"create"` |
| `username` | Which user this is for |
| `token` | A unique ID for this auth session (UUID) |
| `status` | `"pending"` → `"processing"` → `"success"` / `"fail"` |
| `created_at` | When the command was created |

This table acts as a **message queue** — a list of tasks waiting to be processed.

#### 4.3.6 `POST /login` — Login Route

```javascript
app.post('/login', async (req, res) => {
  const { username } = req.body;
  // 1. Check user exists in DB
  // 2. Check user has a gesture password
  // 3. Generate a unique token
  const token = crypto.randomUUID();
  // 4. Delete any stale pending commands for this user
  // 5. Insert a new "auth" command into esp_commands
  // 6. Return { token, status: 'waiting' }
});
```

- **`app.post('/login', ...)`** — registers a route handler: "When someone sends a POST request to `/login`, run this function."
- **`const { username } = req.body;`** — **destructuring** — extracts the `username` field from the request body.
- **`crypto.randomUUID()`** — generates a random **UUID** (Universally Unique Identifier) like `"f47ac10b-58cc-4372-a567-0e02b2c3d479"`. This token uniquely identifies this login attempt.
- **`$1`** in SQL queries — a **parameterized query** placeholder. Instead of putting the username directly in the SQL string (which is vulnerable to **SQL injection** attacks), we use `$1` and pass the value separately: `pool.query('SELECT ... WHERE username = $1', [username])`.
- **`res.json({ token, status: 'waiting' })`** — sends a JSON response. `{ token, status: 'waiting' }` uses **shorthand property names** — `token` is short for `token: token` when the variable name matches the property name.

**What this route does in the big picture**: The browser tells the server "user X wants to log in." The server creates an entry in `esp_commands` with status `pending`. The ESP32 will pick this up on its next poll.

#### 4.3.7 `GET /auth/status?token=xxx` — Auth Status Polling

```javascript
app.get('/auth/status', async (req, res) => {
  const { token } = req.query;
  // Look up the token in esp_commands
  // Return { status: 'pending' | 'processing' | 'success' | 'fail' }
  // If success: create a session and clean up
  // If fail: clean up
});
```

- **`req.query`** — contains URL query parameters. For `/auth/status?token=abc`, `req.query.token` is `"abc"`.
- **`req.session.user = { ... }`** — stores user data in the **session**. After this, every future request from this browser will include the session cookie, and `req.session.user` will be available. This is how the server "remembers" who is logged in.

This is the route the browser polls repeatedly after submitting the login form.

#### 4.3.8 `GET /esp/command` — ESP32 Command Polling

```javascript
app.get('/esp/command', requireEspSecret, async (req, res) => {
  // Find the oldest pending command
  // Mark it as "processing"
  // Return { cmd, username, token }
  // or { none: true } if no commands
});
```

- **`requireEspSecret`** — notice this is passed as a second argument before the handler. Express supports **multiple middleware per route**. The request must pass `requireEspSecret` before reaching the main handler.
- **`ORDER BY created_at ASC LIMIT 1`** — SQL that gets the **oldest** (`ASC` = ascending) pending command, and only **one** (`LIMIT 1`).
- The status changes from `"pending"` → `"processing"` so the command isn't sent to the ESP32 twice.

#### 4.3.9 `GET /user/password?username=xxx` — Fetch Gesture Password

```javascript
app.get('/user/password', requireEspSecret, async (req, res) => {
  // Look up user's gesture_password array
  // Return { gesture_password: [1,2,3,4,5,6] }
});
```

This is how the Logic Node gets the stored password to compare against the gestures the user performs.

#### 4.3.10 `POST /auth/result` — ESP32 Reports Auth Result

```javascript
app.post('/auth/result', requireEspSecret, async (req, res) => {
  const { token, success } = req.body;
  const newStatus = success ? 'success' : 'fail';
  // UPDATE esp_commands SET status = newStatus WHERE token = token
});
```

The ESP32 calls this after comparing gestures. It updates the command status in the database. The browser, which is polling `/auth/status`, will see the new status on its next poll.

#### 4.3.11 `POST /users/create-password` — Save New Gesture Password

```javascript
app.post('/users/create-password', requireEspSecret, async (req, res) => {
  const { username, gestures } = req.body;
  // UPDATE users SET gesture_password = gestures WHERE username = username
});
```

Called by the Logic Node after capturing 6 gestures in create mode. Updates the user's `gesture_password` column in the database.

#### 4.3.12 `POST /esp/command` (admin) — Admin Queues a Create Command

```javascript
app.post('/esp/command', async (req, res) => {
  if (!req.session.user || req.session.user.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden' });
  }
  // Insert a 'create' command into esp_commands
});
```

This is the **same URL** as the ESP32's GET route (`/esp/command`) but a **different HTTP method** (POST vs GET). Express can route the same URL to different handlers based on the method. This route is for the **admin dashboard** (not the ESP32), so it checks the session instead of the ESP secret.

#### 4.3.13 Server Startup

```javascript
initDB()
  .then(() => app.listen(PORT, () => console.log(`Server running on port ${PORT}`)))
  .catch(err => { console.error(err); process.exit(1); });
```

- **`.then()`** — runs after `initDB()` completes successfully. This is **Promise chaining** — an older style of handling async operations (the alternative is `async/await`).
- **`app.listen(PORT, callback)`** — starts the HTTP server, listening for requests on the given port.
- **`.catch()`** — handles errors if `initDB()` fails.
- **`process.exit(1)`** — terminates the program with error code 1 (non-zero means error).

---

### 4.4 `login.html` — Browser Login Page

**Purpose**: The webpage where users enter their username and then perform gesture authentication.

#### 4.4.1 HTML Structure — Three Steps

The page has three "steps" (only one visible at a time):

1. **`stepUsername`** — A form with a username input and a submit button
2. **`stepGesture`** — A "waiting for gesture" animation with 6 dots and a cancel button
3. **`stepResult`** — Shows success (✓) or failure (✗)

The `style="display:none;"` attribute makes steps 2 and 3 invisible initially.

#### 4.4.2 JavaScript Variables

```javascript
let pollInterval = null;   // stores the interval ID for polling
let currentToken = null;   // the auth token from the server
```

- **`let`** — declares a variable that can be reassigned later. (`const` would mean it can't change.)
- **`null`** — represents "no value" / "nothing."

#### 4.4.3 `showStep()` — UI Step Switching

```javascript
function showStep(step) {
  stepUsername.style.display = 'none';
  stepGesture.style.display = 'none';
  stepResult.style.display = 'none';
  step.style.display = 'block';
}
```

Hides all three steps, then shows only the one passed as an argument. `display: 'none'` hides an element; `display: 'block'` shows it.

#### 4.4.4 Form Submit Event — `POST /login`

```javascript
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = document.getElementById('username').value.trim();

  const res = await fetch('/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username }),
  });

  const data = await res.json();
  showStep(stepGesture);
  startPolling(data.token);
});
```

- **`addEventListener('submit', ...)`** — attaches a function to run when the form is submitted.
- **`e.preventDefault()`** — stops the browser's default form submission behavior (which would reload the page). We want to handle it with JavaScript instead.
- **`async (e) => { ... }`** — an **arrow function** (shorthand for `function(e) { ... }`) marked as `async`.
- **`fetch()`** — the browser's built-in function for making HTTP requests (similar to `HTTPClient` on the ESP32).
- **`JSON.stringify({ username })`** — converts a JavaScript object into a JSON string for sending.
- **`await res.json()`** — reads the response body and parses it as JSON.
- **`.trim()`** — removes whitespace from the start and end of a string.

After a successful response, the page switches to the gesture-waiting UI and starts polling.

#### 4.4.5 `startPolling()` — Repeatedly Check Auth Status

```javascript
function startPolling(token) {
  pollInterval = setInterval(async () => {
    const res = await fetch('/auth/status?token=' + encodeURIComponent(token));
    const data = await res.json();

    if (data.status === 'success') {
      clearInterval(pollInterval);
      showResult(true, 'Access Granted', 'Redirecting...');
      setTimeout(() => {
        window.location.href = data.role === 'admin'
          ? '/admin-dashboard.html'
          : '/student-dashboard.html';
      }, 1500);
    }

    if (data.status === 'fail') {
      clearInterval(pollInterval);
      showResult(false, 'Authentication Failed', 'Incorrect gesture password.');
      setTimeout(resetToLogin, 2500);
    }
  }, 1500);
}
```

- **`setInterval(function, delay)`** — repeatedly calls `function` every `delay` milliseconds. Returns an **interval ID** that can be used to stop it later.
- **`clearInterval(pollInterval)`** — stops the interval from running again.
- **`encodeURIComponent(token)`** — encodes special characters in the token for safe use in a URL (e.g., spaces become `%20`).
- **`setTimeout(fn, ms)`** — calls `fn` once after `ms` milliseconds. Used here to delay the redirect after showing the success animation.
- **`window.location.href = '...'`** — navigates the browser to a new URL (like clicking a link).

The polling interval is **1500ms** (1.5 seconds). Each poll asks, "Has the ESP32 reported a result yet?"

#### 4.4.6 `cancelBtn` Click — Reset to Login

```javascript
cancelBtn.addEventListener('click', resetToLogin);
```

If the user clicks "Cancel" during the gesture-waiting step, it stops polling and goes back to the username entry step.

---

### 4.5 `admin-dashboard.html` — Admin Dashboard

**Purpose**: Allows the admin to add students, create gesture passwords, and manage grades.

#### 4.5.1 `init()` — Auth Check on Load

```javascript
async function init() {
  const res = await fetch('/api/me');
  if (!res.ok || (await res.clone().json()).role !== 'admin') {
    window.location.href = '/login.html';
    return;
  }
  const user = await res.json();
  document.getElementById('adminName').textContent = 'Welcome, ' + user.name;
  loadStudents();
}
init();
```

- **`res.clone()`** — creates a **copy** of the response. Response bodies can only be read once in JavaScript; cloning lets us read it twice (once to check the role, once to get the full user data).
- **`res.ok`** — a boolean shorthand for "was the status code 200–299?" (success range).
- This runs immediately when the page loads (`init()` at the bottom). If the user is not logged in or not an admin, they're redirected to the login page.

#### 4.5.2 `startCreatePassword()` — Begin Gesture Password Creation

```javascript
async function startCreatePassword(username) {
  // 1. POST to /esp/command to queue a "create" command
  const res = await fetch('/esp/command', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cmd: 'create', username: username }),
  });

  // 2. Show gesture-waiting UI (dots, cancel button)
  document.getElementById('createStep1').style.display = 'none';
  document.getElementById('createStep2').style.display = 'block';

  // 3. Poll /api/students every 2 seconds to check if password is set
  createPollInterval = setInterval(async () => {
    const r = await fetch('/api/students');
    const students = await r.json();
    const student = students.find(s => s.username === pendingCreateUsername);

    if (student && student.has_password) {
      clearInterval(createPollInterval);
      // Show success animation, reload student list
    }
  }, 2000);
}
```

- **`.find(s => s.username === ...)`** — the `find()` method searches through an array and returns the **first element** that matches the condition. The `s => s.username === ...` is an **arrow function** used as a predicate (a test that returns true or false).
- This function is called when the admin clicks "Create Password" next to a student's name, or automatically after adding a new student.

The polling here is different from the login polling — it checks the `has_password` field of the student. The create flow doesn't use tokens because passwords are set directly in the database.

#### 4.5.3 Student List Rendering

```javascript
tbody.innerHTML = students.map(s => `
  <tr>
    <td>${s.id}</td>
    <td>${s.name}</td>
    <td>${s.username}</td>
    <td>${s.has_password ? '<span class="badge">✓ Set</span>' : '<button onclick="startCreatePassword(...)">Create Password</button>'}</td>
  </tr>
`).join('');
```

- **`.map()`** — transforms every element in an array. Here it converts each student object into an HTML string for a table row.
- **Template literals** (`` ` ` ``) — strings enclosed in backticks that support `${expression}` for inserting variable values. In regular strings (`"..."` or `'...'`), you'd need string concatenation instead.
- **`.join('')`** — joins all the array elements into a single string with no separator.
- **`innerHTML`** — sets the HTML content of an element. Be careful: this replaces everything inside the element.

---

## 5. Complete Program Flow — Authentication

Here's the step-by-step flow when a user logs in:

```
Step  Who                     What Happens
────  ────────────────────    ──────────────────────────────────────
 1    Browser (login.html)    User types username → clicks "Enter Password"
 2    Browser                 POST /login { username: "alice" }
 3    Server (server.js)      Checks user exists → generates token → inserts into
                              esp_commands: { cmd:"auth", username:"alice",
                              token:"abc123", status:"pending" }
 4    Server                  Returns { token:"abc123", status:"waiting" }
 5    Browser                 Shows "Waiting for Gesture" UI → starts polling
                              GET /auth/status?token=abc123 every 1.5s
 6    Logic Node (ESP32 #2)   Next 2-second poll → GET /esp/command
 7    Server                  Returns { cmd:"auth", username:"alice", token:"abc123" }
                              Updates status to "processing"
 8    Logic Node              GET /user/password?username=alice
 9    Server                  Returns { gesture_password: [1,3,2,4,5,6] }
10    Logic Node              Stores password → sendAck(1) to sensor node
                              (1 = enter auth mode)
11    Sensor Node (ESP32 #1)  Receives ack code 1 → sets enterAuthFromServer = true
12    Sensor Node             loop() sees flag → enters AUTH_MODE → blue LED on
13    User                    Performs 6 gestures on the PAJ7620 sensor
14    Sensor Node             For each gesture: sendMessage(0, gesture, 2) to Logic Node
15    Logic Node              onReceive() stores each gesture in inputBuffer[]
16    Logic Node              After 6 gestures: compares inputBuffer vs fetchedPassword
17a   Logic Node (MATCH)      sendAck(2) → Sensor shows green LEDs + beep
17b   Logic Node (NO MATCH)   sendAck(3) → Sensor shows red LED + long buzzer
18    Logic Node              loop() sees authResultReady → POST /auth/result
                              { token:"abc123", success: true/false }
19    Server                  Updates esp_commands status to "success" or "fail"
20    Browser                 Next poll → GET /auth/status?token=abc123
                              Gets { status:"success", role:"admin" }
21    Browser                 Shows "Access Granted" → redirects to dashboard
```

---

## 6. Complete Program Flow — Create Password

```
Step  Who                     What Happens
────  ────────────────────    ──────────────────────────────────────
 1    Admin (dashboard)       Adds a student OR clicks "Create Password"
 2    Browser                 POST /esp/command { cmd:"create", username:"bob" }
 3    Server                  Inserts into esp_commands: { cmd:"create",
                              username:"bob", status:"pending" }
 4    Browser                 Shows gesture-waiting UI → starts polling
                              GET /api/students every 2s (checking has_password)
 5    Logic Node (ESP32 #2)   Next 2-second poll → GET /esp/command
 6    Server                  Returns { cmd:"create", username:"bob" }
                              Updates status to "processing"
 7    Logic Node              Sets createModeActive=true, currentMode=MODE_CREATE
                              → sendAck(0) to Sensor (0 = enter create mode)
 8    Sensor Node (ESP32 #1)  Receives ack code 0 → sets enterCreateFromServer=true
 9    Sensor Node             loop() sees flag → enters CREATE_MODE → blue LED blinks
10    User                    Performs 6 gestures on the sensor
11    Sensor Node             For each gesture: sendMessage(0, gesture, 2)
12    Logic Node              onReceive() stores in newGestures[]
13    Logic Node              After 6 gestures: sendAck(4) → sets createResultReady
14    Sensor Node             Receives ack → green LED + beep → back to IDLE
15    Logic Node              loop() sees createResultReady →
                              POST /users/create-password
                              { username:"bob", gestures:[1,3,2,4,5,6] }
16    Server                  UPDATE users SET gesture_password = ... WHERE username=bob
17    Browser                 Next poll → /api/students → bob now has has_password=true
18    Browser                 Shows success animation → updates student list
```

---

## 7. All Functions Reference Table

### Sensor Node (`sensor.txt`)

| Function | Purpose | Called By |
|---|---|---|
| `setup()` | Initializes sensor, pins, Wi-Fi (STA mode, disconnected), forces channel 6, ESP-NOW, registers peer | Arduino system (runs once at boot) |
| `loop()` | Reads gestures, handles state machine, sends messages | Arduino system (runs forever) |
| `onReceive()` | Handles incoming ESP-NOW messages from Logic Node | ESP-NOW system (callback) |
| `readGesture()` | Reads raw gesture and remaps for sensor rotation | `loop()` |
| `sendMessage()` | Sends a 3-byte Message struct via ESP-NOW | `loop()` |
| `allLedsOff()` | Turns off all four LEDs | Multiple feedback functions |
| `buzzerOn()` / `buzzerOff()` | Controls the buzzer | `beep()` and feedback functions |
| `beep(ms)` | Buzzes for a specified duration | Feedback functions |
| `blinkLed(pin, times, ms)` | Blinks an LED a set number of times | Feedback functions |
| `feedbackGestureReceived()` | Yellow blink + short beep | `loop()` when a gesture is detected |
| `feedbackCreateMode()` | Blue blink animation then solid blue | `loop()` on entering create mode |
| `feedbackSaved()` | Green LED + beep for password saved | `loop()` after 6 create gestures |
| `feedbackAuthMode()` | Solid blue LED | `loop()` on entering auth mode |
| `feedbackAuthSuccess()` | Green blinks + double beep | `loop()` after successful auth |
| `feedbackAuthFail()` | Red LED + long buzz | `loop()` after failed auth |

### Logic Node (`logic.txt`)

| Function | Purpose | Called By |
|---|---|---|
| `setup()` | Connects WiFi, initializes ESP-NOW, registers peer with `WiFi.channel()` | Arduino system |
| `loop()` | Handles deferred HTTP calls, polls for commands | Arduino system |
| `onSend(tx_info, status)` | Tracks ESP-NOW send success/failure (uses `wifi_tx_info_t` parameter) | ESP-NOW system (callback) |
| `onReceive()` | Processes gesture data from Sensor Node | ESP-NOW system (callback) |
| `sendAck(code)` | Sends 1-byte ack to Sensor Node with retry | `pollForCommand()`, `fetchPasswordFromServer()`, `onReceive()` |
| `connectWiFi()` | Connects to the WiFi network | `setup()` and `loop()` (on disconnect) |
| `pollForCommand()` | GET /esp/command — checks for pending work | `loop()` every 2 seconds |
| `fetchPasswordFromServer(username)` | GET /user/password — downloads stored password | `pollForCommand()` (after auth command) |
| `postAuthResult(success)` | POST /auth/result — reports pass/fail | `loop()` (deferred from callback) |
| `postNewPassword()` | POST /users/create-password — uploads new password | `loop()` (deferred from callback) |

### Server (`server.js`)

| Function / Route | Method | Purpose | Called By |
|---|---|---|---|
| `initDB()` | — | Creates tables, seeds admin user | Server startup |
| `requireEspSecret()` | — | Middleware: validates ESP secret header | ESP-specific routes |
| `POST /login` | POST | Queues an auth command for ESP32 | Browser (login form) |
| `GET /auth/status` | GET | Returns auth command status | Browser (polling) |
| `GET /logout` | GET | Destroys session, redirects to login | Browser (logout link) |
| `GET /api/me` | GET | Returns logged-in user info | Browser (auth check) |
| `GET /esp/command` | GET | Returns next pending command for ESP32 | Logic Node (polling) |
| `GET /user/password` | GET | Returns stored gesture password | Logic Node |
| `POST /auth/result` | POST | Updates command status to success/fail | Logic Node |
| `POST /users/create-password` | POST | Saves new gesture password | Logic Node |
| `POST /esp/command` | POST | Admin queues a create command | Browser (admin dashboard) |
| `GET /api/students` | GET | Lists all students | Browser (admin dashboard) |
| `POST /api/students` | POST | Creates a new student | Browser (admin dashboard) |

### Browser — `login.html`

| Function | Purpose | Triggered By |
|---|---|---|
| `showAlert(msg, type)` | Shows an alert message | Form validation errors |
| `showStep(step)` | Switches between the 3 UI steps | Login flow progression |
| `showResult(success, title, subtitle)` | Displays success/failure icon and text | Auth result received |
| `resetToLogin()` | Resets everything back to username entry | Cancel button, auth failure timeout |
| `startPolling(token)` | Begins polling `/auth/status` every 1.5s | After successful `/login` POST |
| Form `submit` handler | POSTs username to `/login` | User clicks "Enter Password" |
| Cancel `click` handler | Calls `resetToLogin()` | User clicks "Cancel" |

### Browser — `admin-dashboard.html`

| Function | Purpose | Triggered By |
|---|---|---|
| `init()` | Checks admin session, loads students | Page load |
| `showAlert(id, msg, type)` | Shows alert in the specified card | Various actions |
| `loadStudents()` | Fetches and renders student list + dropdowns | `init()`, after add/create actions |
| `startCreatePassword(username)` | Queues create command, shows gesture UI, polls | "Create Password" button, after adding student |
| `viewGrades(studentId, name)` | Fetches and renders grades for a student | "View Grades" button |
| Form `addStudentForm` handler | POSTs new student data | Admin submits add student form |
| Form `gradeForm` handler | POSTs grade data | Admin submits grade form |
| Cancel create `click` handler | Stops create-password polling, resets UI | Admin clicks "Cancel" during create |

---

## 8. All Keywords & Concepts Glossary

### C/C++ (Arduino) Keywords & Concepts

| Keyword / Concept | Explanation |
|---|---|
| `#include` | Preprocessor directive that copies the contents of a header file into your code |
| `#define` | Preprocessor macro that does text replacement before compilation |
| `void` | A return type meaning "this function returns nothing" |
| `uint8_t` | Unsigned 8-bit integer type (0–255) |
| `const` | Marks a variable or parameter as read-only (cannot be modified) |
| `volatile` | Tells the compiler this variable may change outside normal execution (e.g., in an interrupt or callback) |
| `typedef` | Creates a new name (alias) for an existing type |
| `struct` | A custom data type that groups related variables together |
| `enum` | Defines a set of named integer constants |
| `switch / case / break / default` | A multi-branch conditional — compares one value against many possible matches |
| `return` | Exits a function and optionally sends back a value |
| `sizeof` | Compile-time operator that returns the size (in bytes) of a type or variable |
| `memcpy()` | Copies a block of bytes from one memory location to another |
| `memset()` | Sets a block of memory to a specified value (e.g., zeroing an array) |
| `strcmp()` | Compares two C-strings; returns 0 if they are equal |
| `millis()` | Returns the number of milliseconds since the ESP32 booted |
| `delay()` | Pauses program execution for a specified number of milliseconds (blocking) |
| `Serial.begin()` | Initializes serial communication at a given baud rate |
| `Serial.println()` / `Serial.printf()` | Prints text to the serial monitor for debugging |
| `digitalWrite()` | Sets a GPIO pin to HIGH (3.3V) or LOW (0V) |
| `pinMode()` | Configures a GPIO pin as INPUT or OUTPUT |
| Pointer (`*`) | A variable that holds a memory address instead of a value |
| Address-of (`&`) | Operator that gives the memory address of a variable |
| Type cast `(uint8_t*)` | Tells the compiler to treat a pointer as a different type |
| `continue` | Skips the rest of the current loop iteration and starts the next one |
| State machine | A design pattern where the program can be in one of several defined states, and behavior changes based on the current state |
| Callback function | A function you register with a library that gets called automatically when an event occurs |
| Flag-based async | Setting a boolean flag in a callback, then checking it in the main loop to do heavy work safely |
| I²C (Wire) | A two-wire serial communication protocol used to talk to sensors and peripherals |
| ESP-NOW | Espressif's peer-to-peer wireless protocol — no router needed, uses MAC addresses |
| MAC address | A unique 6-byte hardware identifier for each network device |
| WiFi channel | A specific frequency band (1–13) on which WiFi and ESP-NOW operate. Both devices must use the same channel. |
| `esp_wifi_set_channel()` | Low-level ESP-IDF function to force the radio to a specific WiFi channel |
| `WiFi.disconnect()` | Tells the ESP32 to not connect to any WiFi network (used on the Sensor Node which only needs ESP-NOW) |
| `WiFi.channel()` | Returns the WiFi channel the ESP32 is currently using (determined by the router after connecting) |
| `wifi_tx_info_t` | A struct containing WiFi transmission details (retry count, signal strength, etc.) used in the newer ESP-NOW send callback signature |
| `WIFI_SECOND_CHAN_NONE` | Constant meaning "don't use a secondary WiFi channel" (passed to `esp_wifi_set_channel`) |
| Baud rate | Speed of serial communication in bits per second |
| GPIO | General Purpose Input/Output — the pins on the ESP32 that connect to external hardware |

### JavaScript / Node.js Keywords & Concepts

| Keyword / Concept | Explanation |
|---|---|
| `const` / `let` | Variable declarations. `const` cannot be reassigned; `let` can be |
| `async` / `await` | Makes asynchronous code look synchronous. `await` pauses until a Promise resolves |
| `Promise` | An object representing a value that may be available in the future (from an async operation) |
| `.then()` / `.catch()` | Methods on Promises for handling success and errors (alternative to `async/await`) |
| Arrow function `() => {}` | Shorthand function syntax |
| `require()` | Node.js function to import modules (libraries) |
| `module.exports` | Node.js way to export something from a module |
| Destructuring `{ x } = obj` | Extracts properties from objects or elements from arrays into variables |
| Template literal `` `${}` `` | String with embedded expressions, using backticks |
| Ternary `? :` | Shorthand if-else: `condition ? ifTrue : ifFalse` |
| `fetch()` | Browser API for making HTTP requests |
| `JSON.stringify()` | Converts a JavaScript object to a JSON string |
| `JSON.parse()` / `res.json()` | Converts a JSON string to a JavaScript object |
| `setInterval()` | Repeatedly calls a function at a given time interval |
| `clearInterval()` | Stops a running interval |
| `setTimeout()` | Calls a function once after a specified delay |
| `document.getElementById()` | Finds an HTML element by its `id` attribute |
| `addEventListener()` | Attaches a function to run when a specific event occurs (click, submit, etc.) |
| `e.preventDefault()` | Stops the browser's default behavior for an event (like form submission page reload) |
| `.style.display` | CSS property that controls whether an element is visible (`'block'`) or hidden (`'none'`) |
| `.innerHTML` | Sets or gets the HTML content inside an element |
| `.textContent` | Sets or gets the plain text content of an element |
| `.classList.add()` | Adds a CSS class to an element |
| `.map()` | Creates a new array by transforming every element of the original |
| `.find()` | Returns the first element in an array that passes a test |
| `.join()` | Joins all array elements into a single string |
| `.trim()` | Removes whitespace from both ends of a string |
| `encodeURIComponent()` | Encodes special characters for safe use in URLs |
| `window.location.href` | Gets or sets the current page URL (setting it navigates the browser) |
| `res.clone()` | Creates a copy of a fetch Response (body can only be read once) |
| `res.ok` | Boolean — true if the HTTP status code is in the 200–299 range |

### Express.js / Backend Concepts

| Concept | Explanation |
|---|---|
| `app.get()` / `app.post()` | Register route handlers for GET and POST HTTP methods |
| Middleware | Functions that process requests before they reach the route handler |
| `req` (Request) | Object containing everything about the incoming HTTP request |
| `res` (Response) | Object used to send data back to the client |
| `next()` | Function that passes control to the next middleware |
| `req.body` | The parsed body of a POST request |
| `req.query` | URL query parameters (e.g., `?key=value`) |
| `req.params` | URL path parameters (e.g., `/grades/:studentId`) |
| `req.headers` | HTTP request headers |
| `req.session` | Session data stored on the server, identified by a cookie |
| `res.json()` | Sends a JSON response |
| `res.status()` | Sets the HTTP response status code |
| `res.redirect()` | Redirects the browser to a different URL |
| Session | Server-side storage that persists across multiple requests from the same browser |
| Cookie | A small piece of data the server sends to the browser, which the browser sends back with every request |
| Environment variable (`process.env`) | Configuration values set outside the code (for security and flexibility) |
| Parameterized queries (`$1, $2`) | SQL injection prevention — values are passed separately from the query string |
| Connection pool | A set of reusable database connections (avoids the overhead of creating new connections) |
| UUID | Universally Unique Identifier — a 128-bit random ID virtually guaranteed to be unique |
| REST API | A style of web API where URLs represent resources and HTTP methods represent actions |
| Message queue (esp_commands table) | A pattern where tasks are stored in a database and processed asynchronously |
| Polling | Repeatedly checking for new data at regular intervals |

---

> **Key takeaway**: The `esp_commands` database table is the glue that connects everything. The browser writes commands into it, the ESP32 reads commands from it and writes results back, and the browser reads those results. No part of the system talks directly to another — they all go through this table on the server. This architecture is called **asynchronous message passing** and it's a very common pattern for systems where the parts can't be online at the same time.
>
> The other critical piece is **WiFi channel synchronisation** — the Sensor Node hardcodes channel 6 with `esp_wifi_set_channel(6, ...)`, and the Logic Node uses `WiFi.channel()` after connecting to the router. If the router operates on a different channel than 6, you would need to update the hardcoded value in `sensor.txt` to match.
