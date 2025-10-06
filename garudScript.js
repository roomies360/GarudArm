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
        }, 9000);



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

        let ws;
        const refreshBtn = document.getElementById("refresh");
        const caliberateBtn = document.getElementById("caliberate");
        function connectWebSocket() {
            if (ws && ws.readyState !== WebSocket.CLOSED) {
                ws.close();
            }
            ws = new WebSocket(`ws://{window.location.host}/`);
            ws.onopen = () => {
                console.log("WebSocket connected");
                refreshBtn.classList.remove("button-disabled");
                refreshBtn.classList.remove("spin");
                setRadarDisconnected(false);
            };
            ws.onmessage = (evt) => {
                console.log("WS message:", evt.data);
                if (evt.data.includes("caliberation success")) {
                    caliberateBtn.classList.remove("button-disabled");
                    caliberateBtn.style.backgroundColor = "#191919";
                    caliberateBtn.style.color = "#444444";
                }
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


        // ----------------- WebSocket Message Sender -----------------
        function sendWSMessage(type, value) {
            if (ws && ws.readyState === WebSocket.OPEN) {
                ws.send(`${type}:${value}`);
                console.log("Sent ->", `${type}:${value}`);
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
        let lastLeftPWM = 128, lastRightPWM = 128;

        // Convert normalized value (-1 to 1) to PWM (0-255)
        function toPWM(value) {
            return Math.round((value * 127) + 128);
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

            console.log(`MOVE -> Left: ${leftPWM}, Right: ${rightPWM}`);
            // ws.send(`MOTOR:${leftPWM},${rightPWM}`);
        }

        function stopMove() {
            lastLeftPWM = 128;
            lastRightPWM = 128;
            console.log("STOP -> Left: 128, Right: 128");
            // ws.send(`STOP`);
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



        // ---------------------- Sliders ----------------------
        const sliders = [
            { element: document.getElementById('base'), channel: 0},
            { element: document.getElementById('shoulder'), channel: 1},
            { element: document.getElementById('elbow'), channel: 2}
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
                // ws.send(`SERVO:${sliderObj.channel}:${angle}`); // Uncomment to send to ESP
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

        // Gripper buttons
        const holdBtn = document.getElementById("hold-btn");
        const placeBtn = document.getElementById("place-btn");
        const ch = 5;
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

