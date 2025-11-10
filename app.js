const video = document.getElementById('video');
const notice = document.getElementById('notice');
const LDES_URL = 'labeled_descriptors.json';
const INTENT_PREFIX = 'myclockin://?id=';
const COOLDOWN = 4000;
let lastSent = {};

async function loadModels(){
  await faceapi.nets.tinyFaceDetector.loadFromUri('./models');
  await faceapi.nets.faceLandmark68Net.loadFromUri('./models');
  await faceapi.nets.faceRecognitionNet.loadFromUri('./models');
}

async function startVideo(){
  try {
    const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
    video.srcObject = s;
  } catch(e){
    notice.textContent = 'Camera permission required';
    console.error(e);
  }
}

async function loadLabeled(){
  const r = await fetch(LDES_URL);
  const data = await r.json();
  return data.map(ld => new faceapi.LabeledFaceDescriptors(
    ld.label,
    ld.descriptors.map(d => new Float32Array(d))
  ));
}

async function run(){
  await loadModels();
  const labeled = await loadLabeled();
  const matcher = new faceapi.FaceMatcher(labeled, 0.45);
  await startVideo();

  video.addEventListener('play', () => {
    const canvas = faceapi.createCanvasFromMedia(video);
    document.body.appendChild(canvas);
    const size = { width: video.videoWidth, height: video.videoHeight };
    faceapi.matchDimensions(canvas, size);

    setInterval(async () => {
      const detections = await faceapi.detectAllFaces(video, new faceapi.TinyFaceDetectorOptions()).withFaceLandmarks().withFaceDescriptors();
      canvas.getContext('2d').clearRect(0,0,canvas.width,canvas.height);
      if (!detections.length) { notice.textContent = 'No face'; return; }
      const best = matcher.findBestMatch(detections[0].descriptor);
      if (best.label && best.label !== 'unknown') {
        notice.textContent = 'Detected: ' + best.label;
        const now = Date.now();
        if (!lastSent[best.label] || now - lastSent[best.label] > COOLDOWN) {
          lastSent[best.label] = now;
          window.location = INTENT_PREFIX + encodeURIComponent(best.label);
        }
      } else {
        notice.textContent = 'Unknown';
      }
    }, 700);
  });
}

run();
