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
    ws = new WebSocket("ws://esp32.local:81/");
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

// Joystick Working
const container = document.getElementById('joystickContainer');
const knob = document.getElementById('joystick');
const info = document.getElementById('info');
const maxRadius = container.offsetWidth / 2 - knob.offsetWidth / 2;

let dragging = false;

function sendMove(angle, speed) {
    sendWSMessage("MOVE", `${angle}:${speed}`);
}

function stopMove() {
    sendWSMessage("STOP", "0");
}

function getAngleSpeed(x, y) {
    let dx = x - container.offsetWidth / 2;
    let dy = y - container.offsetHeight / 2;
    let angle = Math.atan2(dy, dx); // radians
    let distance = Math.sqrt(dx * dx + dy * dy);
    let speed = Math.min(distance / maxRadius, 1); // normalize 0–1
    return { angle, speed };
}

function updateKnob(x, y) {
    let dx = x - container.offsetWidth / 2;
    let dy = y - container.offsetHeight / 2;
    let distance = Math.sqrt(dx * dx + dy * dy);
    if (distance > maxRadius) {
        let ratio = maxRadius / distance;
        dx *= ratio; dy *= ratio;
    }
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
}

function onMove(event) {
    if (!dragging) return;
    let rect = container.getBoundingClientRect();
    let x = (event.touches ? event.touches[0].clientX : event.clientX) - rect.left;
    let y = (event.touches ? event.touches[0].clientY : event.clientY) - rect.top;
    updateKnob(x, y);
    let { angle, speed } = getAngleSpeed(x, y);
    sendMove(angle, speed);
    let angleDeg = Math.round(angle * 180 / Math.PI);
    let speedPct = Math.round(speed * 100);
    info.innerHTML = `Angle: ${angleDeg}° | Speed: ${speedPct}%`;
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



// Sliders 
function updateSliderBackground(el) {
    const val = (el.value - el.min) / (el.max - el.min) * 100;
    el.style.setProperty("--val", val + "%");
}
const sliders = document.querySelectorAll('.sliders');
const sliderChannelMap = {
    base: 0,
    elbow: 1,
    shoulder: 2
};
sliders.forEach(slider => {
    slider.addEventListener("input", e => {
        updateSliderBackground(e.target);
        const channel = sliderChannelMap[slider.id.toLowerCase()];
        sendWSMessage("SERVO", `${channel}:${e.target.value}`); // SERVO:channel:angle
    });
    updateSliderBackground(slider);
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
