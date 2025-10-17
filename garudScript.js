
        let ws;
        const refreshBtn = document.getElementById("refresh");
        const caliberateBtn = document.getElementById("caliberate");
        function connectWebSocket() {
            if (ws && ws.readyState !== WebSocket.CLOSED) {
                ws.close();
            }
            ws = new WebSocket(`ws://${window.location.host}:81/`);
            ws.onopen = () => {
                console.log("WebSocket connected");
                refreshBtn.classList.remove("button-disabled");
                refreshBtn.classList.remove("spin");
                setRadarDisconnected(false);
            };
            ws.onmessage = (evt) => {
                console.log("WS message:", evt.data);
                const msg = evt.data.toLowerCase();
                /* if (msg.startsWith("SERVO:")) {
                    const parts = msg.split(':');
                    if (parts.length >= 3) {
                        const ch = parts[1].trim();
                        const ang = parts[2].trim();
                        setServoAngle(ch, ang);
                        return;
                    }
                } */
                if (msg.includes("caliberation success")) {
                    caliberateBtn.classList.remove("button-disabled");
                    caliberateBtn.style.backgroundColor = "#191919";
                    caliberateBtn.style.color = "#444444";
                } /* else if (msg.startsWith("ANGLES:")) {
                    const payload = msg.slice(7);
                    payload.split(',').forEach(pair => {
                        const [ch, ang] = pair.split('=').map(s => s && s.trim());
                        if (ch && ang !== undefined) setServoAngle(ch, ang);
                    });
                    return;
                }
                    */

            };
            ws.onclose = () => {
                console.log("WebSocket closed");
                setRadarDisconnected(true);
            };

            ws.onerror = (err) => {
                console.error("WebSocket error:", err);
                setRadarDisconnected(true);
            };
        }
        connectWebSocket();  // initialize on page load


        // ---------------------- Sliders ----------------------
        const servoState = {}; // channel -> angle e.g. { "1": 90, "2": 45 }

        const sliders = [
            { element: document.getElementById('base'), channel: 0 },
            { element: document.getElementById('universal-slider'), channel: 1 },
        ];

        const CENTER_VALUE = 50;
        const SEND_INTERVAL = 75; // send every 75ms
        const ANGLE_MAX = 30;

        sliders.forEach(sliderObj => {
            let intervalId = null;

            function mapSliderToAngle(value) {
                const relative = value - CENTER_VALUE; // -50 to +50
                return Math.round((relative / CENTER_VALUE) * ANGLE_MAX);
            }

            function sendAngle() {
                const angle = mapSliderToAngle(sliderObj.element.value);
                console.log(`Sent -> SERVO:${sliderObj.channel}:${angle}`);
                ws.send(`SERVO:${sliderObj.channel}:${angle}`); // Uncomment to send to ESP
            }

            function startSending() {
                sendAngle(); // immediate send
                if (intervalId) clearInterval(intervalId);
                intervalId = setInterval(sendAngle, SEND_INTERVAL);
            }

            function stopSending() {
                if (intervalId) clearInterval(intervalId);
                intervalId = null;
                sliderObj.element.value = CENTER_VALUE; // return to center
                sendAngle(); // send 0° after release
            }

            sliderObj.element.addEventListener('mousedown', startSending);
            sliderObj.element.addEventListener('touchstart', startSending);

            window.addEventListener('mouseup', stopSending);
            window.addEventListener('touchend', stopSending);
        });


        // ---------------------- Servo Selection ----------------------
        const servoButtons = document.querySelectorAll(".servo-selection-btn");
        const display = document.getElementById("display");
        let selectedServo = "shoulder";

        servoButtons.forEach(btn => {
            btn.addEventListener("click", () => {
                servoButtons.forEach(b => b.classList.remove("selected-servo"));
                btn.classList.add("selected-servo");
                sliders[1].channel = btn.dataset.channel;
            });
        });

        // --- Servo state store ---
        /*function setServoAngle(channel, angle) {
            servoState[String(channel)] = Number(angle);
            // update display if current selected channel matches
            if (sliders[1].channel == channel || sliders[0].channel == channel) {
                display.textContent = `${servoState[String(channel)]}°`;
            }
            // If the UI has a selected servo button highlight, reflect its angle
            const btn = Array.from(servoButtons).find(b => b.dataset.channel === String(channel));
            if (btn && btn.classList.contains('selected-servo')) {
                display.textContent = `${servoState[String(channel)]}°`;
            }
        }
        */

        const connectingText = document.getElementById("connectContainer");

        function startConnectingAnimation() {
            connectingText.style.display = "flex";
        }

        function stopConnectingAnimation() {
            connectingText.style.display = "none";
        }

        startConnectingAnimation();
        setTimeout(() => {
            stopConnectingAnimation();
            document.getElementById('landing-page').style.display = 'none';
        }, 1);


        const radarCenter = document.querySelector(".radar-center");
        const radarWaves = document.querySelectorAll(".radar-wave");

        function setRadarDisconnected(state) {
            if (state) {
                radarCenter.classList.add("disconnected");
                radarWaves.forEach(w => w.classList.add("disconnected"));
            } else {
                radarCenter.classList.remove("disconnected");
                radarWaves.forEach(w => w.classList.remove("disconnected"));
            }
        }

        function disableButton(btn) {
            btn.classList.add("button-disabled");
        }
        function enableButton(btn) {
            btn.classList.remove("button-disabled");
        }

        // Refresh Button
        refreshBtn.addEventListener("click", () => {
            if (refreshBtn.classList.contains("button-disabled")) return; // prevent click if disabled
            refreshBtn.classList.add("spin");
            disableButton(refreshBtn);
            connectWebSocket();
        });
        // Calibrate button
        caliberateBtn.addEventListener("click", () => {
            if (caliberateBtn.classList.contains("button-disabled")) return;
            disableButton(caliberateBtn, 2000);
            caliberateBtn.style.backgroundColor = "#80b7ee";
            caliberateBtn.style.color = "#fff";
            sendWSMessage("CALIBRATE", "");
        });

        // Home button
        const homeBtn = document.getElementById("home-btn");
        homeBtn.addEventListener("click", () => {
            sendWSMessage("HOME", "");
        });

        // --- Editable servo angle send ---
        const servoAngleSpan = document.getElementById("servo-angle");
        servoAngleSpan.addEventListener("keydown", (event) => {
            if (event.key === "Enter") {
                event.preventDefault(); // prevent newline
                const raw = servoAngleSpan.textContent.trim();
                const angle = parseInt(raw, 10);

                if (!isNaN(angle) && angle >= 0 && angle <= 160) {
                    const channel = sliders[1].channel; // current selected servo channel
                    const msg = `SETMOTOR:${channel}:${angle}`;
                    console.log("Sent ->", msg);
                    if (ws && ws.readyState === WebSocket.OPEN) {
                        ws.send(msg);
                    } else {
                        console.warn("WebSocket not connected");
                    }
                } else {
                    console.warn("Invalid angle:", raw);
                }

                // remove focus after enter
                servoAngleSpan.blur();
            }
        });



        // ----------------- WebSocket Message Sender -----------------
        function sendWSMessage(type, value) {
            if (ws && ws.readyState === WebSocket.OPEN) {
                ws.send(`${type}:${value}`);
            } else {
                console.warn("WebSocket not connected");
            }
        }

        // ---------------------- Joystick ----------------------
        const container = document.getElementById('joystickContainer');
        const knob = document.getElementById('joystick');
        const maxRadius = container.offsetWidth / 2 - knob.offsetWidth / 2;

        let dragging = false;
        let lastSentTime = 0;
        const JOY_SEND_INTERVAL = 50; // ms
        let lastLeftPWM = 0, lastRightPWM = 0;

        // Convert normalized value (-1 to 1) to PWM (-255 to 255)
        function toPWM(value) {
            return Math.round(value * 255);
        }

        // Differential drive PWM calculation
        function calculateMotorPWM(normX, normY) {
            let left = normY + normX;
            let right = normY - normX;
            left = Math.max(-1, Math.min(1, left));
            right = Math.max(-1, Math.min(1, right));
            return { leftPWM: toPWM(left), rightPWM: toPWM(right) };
        }

        // Send only if significant change or interval passed
        function sendMove(x, y) {
            const now = Date.now();
            if (now - lastSentTime < JOY_SEND_INTERVAL) return;
            lastSentTime = now;

            const normX = x / maxRadius;
            const normY = -y / maxRadius;

            let { leftPWM, rightPWM } = calculateMotorPWM(normX, normY);

            // Deadzone filtering
            if (Math.abs(leftPWM - lastLeftPWM) < 10 && Math.abs(rightPWM - lastRightPWM) < 10) return;

            lastLeftPWM = leftPWM;
            lastRightPWM = rightPWM;

            ws.send(`MOTOR:${leftPWM},${rightPWM}`);
        }

        // Stop motors when joystick released
        function stopMove() {
            lastLeftPWM = 0;
            lastRightPWM = 0;
            ws.send(`STOP`);
        }

        function updateKnob(x, y) {
            let dx = x;
            let dy = y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            if (distance > maxRadius) {
                const ratio = maxRadius / distance;
                dx *= ratio;
                dy *= ratio;
            }
            knob.style.transform = `translate(${dx}px, ${dy}px)`;
        }

        function onMove(event) {
            if (!dragging) return;
            const rect = container.getBoundingClientRect();
            const x = (event.touches ? event.touches[0].clientX : event.clientX) - rect.left - container.offsetWidth / 2;
            const y = (event.touches ? event.touches[0].clientY : event.clientY) - rect.top - container.offsetHeight / 2;
            updateKnob(x, y);
            sendMove(x, y);
        }

        function startDrag(event) {
            dragging = true;
            onMove(event);
        }

        function endDrag() {
            dragging = false;
            knob.style.transform = 'translate(0px,0px)';
            stopMove();
        }

        container.addEventListener('mousedown', startDrag);
        container.addEventListener('touchstart', startDrag);
        window.addEventListener('mousemove', onMove);
        window.addEventListener('touchmove', onMove);
        window.addEventListener('mouseup', endDrag);
        window.addEventListener('touchend', endDrag);


        // Gripper buttons
        const holdBtn = document.getElementById("hold-btn");
        const placeBtn = document.getElementById("place-btn");
        const ch = 6;
        holdBtn.addEventListener("click", () => {
            holdBtn.classList.add("active");
            placeBtn.classList.remove("active");
            sendWSMessage("GRIPPER", `${ch}:HOLD`);
        });

        placeBtn.addEventListener("click", () => {
            placeBtn.classList.add("active");
            holdBtn.classList.remove("active");
            sendWSMessage("GRIPPER", `${ch}:PLACE`);
        });


