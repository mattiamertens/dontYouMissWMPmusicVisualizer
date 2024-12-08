import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import openSimplexNoise from 'https://cdn.skypack.dev/open-simplex-noise';

// var requirejs = require('node_module/requirejs/requirejs');

// requirejs.config({
//     //Pass the top-level main.js/index.js require
//     //function to requirejs so that node modules
//     //are loaded relative to the top-level JS file.
//     nodeRequire: require
// });

// requirejs(['foo', 'bar'],
// function   (foo,   bar) {
//     //foo and bar are loaded according to requirejs
//     //config, but if not found, then node's require
//     //is used to load the module.
// });


const width = document.documentElement.clientWidth;
const height = document.documentElement.clientHeight;

const w = window.innerWidth;
const h = window.innerHeight;

const container = document.getElementById('canvas');
const c_width = container.clientWidth;
const c_height = container.clientHeight;


// Create a scene
const scene = new THREE.Scene();

// Create a camera
const camera = new THREE.PerspectiveCamera(100, c_width / c_height);
camera.position.z = 8;


// Create a renderer
const renderer = new THREE.WebGLRenderer({antialias: true});
// renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setSize(c_width, c_height);
renderer.setClearColor(0xEBEBEB, 1);

// Disable zooming
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableZoom = false;

document.getElementById('canvas').appendChild(renderer.domElement);

// SPHERE GEOMETRY
let sphereGeometry = new THREE.SphereGeometry(3, 100, 100);
sphereGeometry.positionData = [];
let initialDistances = new Float32Array(sphereGeometry.attributes.position.count);
let v3 = new THREE.Vector3();
for (let i = 0; i < sphereGeometry.attributes.position.count; i++){
    v3.fromBufferAttribute(sphereGeometry.attributes.position, i);
    sphereGeometry.positionData.push(v3.clone());
    initialDistances[i] = v3.length(); // Store initial distance
}

// Add initialDistance attribute
sphereGeometry.setAttribute('initialDistance', new THREE.BufferAttribute(initialDistances, 1));

// SHADER MATERIAL
let sphereMesh = new THREE.ShaderMaterial({
    uniforms: {      
        colorA: {type: 'vec3', value: new THREE.Vector3(0.5, 0.5, 0.5)},
    },
    vertexShader: document.getElementById('codeV').textContent,
    fragmentShader: document.getElementById('codeF').textContent,
    // wireframe: true
});



let sphere = new THREE.Mesh(sphereGeometry, sphereMesh);
scene.add(sphere);

const listener = new THREE.AudioListener();
camera.add(listener);

const sound = new THREE.Audio(listener);
const audioLoader = new THREE.AudioLoader();


$('.play').on('click', function(){
    
    if (sound.isPlaying){
        sound.stop();
    }
    else {
        sound.play();
    }
});

const analyser = new THREE.AudioAnalyser(sound, 32);


let noise = openSimplexNoise.makeNoise4D(Date.now());
let clock = new THREE.Clock();

// Mouse position
let mouse = new THREE.Vector2();
let mouse3D = new THREE.Vector3();
let raycaster = new THREE.Raycaster();

// Add event listener for mouse move
window.addEventListener('mousemove', (event) => {
    // Normalize mouse position to range [-1, 1]
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = - (event.clientY / window.innerHeight) * 2 + 1;

    // Convert mouse position to 3D
    mouse3D.set(mouse.x, mouse.y, 0);
    mouse3D.unproject(camera);
});

// Animation loop
function animate() {
    requestAnimationFrame(animate);
    let elapsedTime = clock.getElapsedTime()/1.0;

    let audioData = analyser.data;
    let avgfrequency = analyser.getAverageFrequency()/60;
    // console.log(audioData);


    sphereGeometry.positionData.forEach((p, idx) => {
        let audioFactor = audioData[idx % audioData.length] / 256;
        let noiseValue = noise(
            p.x * (avgfrequency), 
            p.y * (avgfrequency), 
            p.z * (avgfrequency), 
            elapsedTime * 0.7
        );
        
        // Apply a low-pass filter or smooth the noise value over time
        let smoothNoiseValue = lerp(p.noisePrevValue || noiseValue, noiseValue, 0.01);
        p.noisePrevValue = smoothNoiseValue; // Store the previous noise value for smoothing
        
        // Scale down the noise contribution to make the transition smoother
        let combinedValue = smoothNoiseValue + audioFactor * 0.005;
    
        v3.copy(p).addScaledVector(p, combinedValue);
        sphereGeometry.attributes.position.setXYZ(idx, v3.x, v3.y, v3.z);
    });
    
    // Function to linearly interpolate between two values
    function lerp(start, end, t) {
        return start * (1 - t) + end * t;
    }

    sphereGeometry.computeVertexNormals();
    sphereGeometry.attributes.position.needsUpdate = true;

    sphere.rotation.y += 0.0006;
    sphere.rotation.x += -0.0006;

    // Update raycaster with mouse position
    raycaster.setFromCamera(mouse, camera);
   
    let direction = mouse3D.clone().sub(sphere.position).normalize();
    sphere.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), direction);

    // Render the scene
    renderer.render(scene, camera);
}


function onWindowResize() {
    const newWidth = container.clientWidth;
    const newHeight = container.clientHeight;
    camera.aspect = newWidth / newHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(newWidth, newHeight);
    console.log('resizing');
}
window.addEventListener('resize', onWindowResize);

// Start the animation loop
animate();


// D3 code for songs
import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7/+esm";


const form = document.getElementById('fileUpload');
const fileInput = document.getElementById('file');

form.addEventListener('submit', function(e){
    e.preventDefault();
    let file = fileInput.files[0];
    // console.log(file);


    if (file){
        const fileURL = URL.createObjectURL(file);
        // console.log(fileURL);  
        
        audioLoader.load(fileURL, 
            function(buffer){
                sound.setBuffer(buffer);
                sound.setLoop(true);
            },
            function(xhr){
                var percentage = (xhr.loaded / xhr.total * 100) + '% uploaded';
                // console.log(percentage);
                var progress = $('.percentage')[0];
                progress.innerHTML = percentage;
            },
            function (err){
                console.error(err);
            }
        );
    }
    
});

// Audio toggle
let soundVolume = false;
$('.muter').on('click', function(){
    if (soundVolume) {
        $('.muter-text')[0].innerHTML = "sound on";
        sound.play();
        soundVolume = false;

    } else {
        $('.muter-text')[0].innerHTML = "sound off";
        sound.stop();
        soundVolume = true;
    }
})











// function videoFetcher() {
//     fetch("https://www.googleapis.com/youtube/v3/videos?id=kIAKwJu7COo&key=AIzaSyA_AUzrqg1xqpbQikOmtWIUIciEUSd7wuA&part=snippet")
//         .then((response) => response.json())
//         .then((json) => {

//             var url = `https://www.youtube.com/watch?v=${json.items[0].id}`;
//             const actualVideo = document.createElement('video');
//             actualVideo.src = url;
//             document.getElementsByClassName('video-container')[0].appendChild(actualVideo);
//         });
// }
// videoFetcher();

// // Youtube API SONGS

// let player;
// let isPlaying = false;

// function onYouTubeIframeAPIReady() {
//     console.log('API ready');
    
//     player = new YT.Player('player', {
//         height: '360',
//         width: '640',
//         videoId: 'kIAKwJu7COo', // Replace with your YouTube video ID
//         playerVars: { 'playsinline': 1, 'controls': 0 },
//         events: { 'onReady': onPlayerReady, 'onError': onPlayerError, 'onStateChange': onPlayerStateChange }
//     });
// }

// function onPlayerReady(event) {
//     console.log('Player ready');
// }
// function onPlayerError(event) {
//     console.error('YouTube Player error:', event.data);
// }
// function onPlayerStateChange(event) {
//     if (event.data === YT.PlayerState.PLAYING) {
//         isPlaying = true;
//         // DO SOMETHING
//         console.log('Video is playing');
//     }
//     else {
//         isPlaying = false;
//         // DO SOMETHING
//         console.log('Video is paused');
//     }
// }

// onYouTubeIframeAPIReady();

// const audioContext = new (window.AudioContext || window.webkitAudioContext)();
// const webAnalyser = audioContext.createAnalyser();
// const source = audioContext.createMediaElementSource(document.getElementById('player'));

// // Connect the audio graph
// source.connect(webAnalyser);
// webAnalyser.connect(audioContext.destination);
// console.log(webAnalyser)

// function initializeAudioProcessing() {
//     // Create a buffer and pass it to Three.js for visualization
//     visualizeAudio(webAnalyser);
// }



// function visualizeAudio(webAnalyser) {
//     // analyser.fftSize = 256;
//     const bufferLength = analyser.frequencyBinCount;
//     const dataArray = new Uint8Array(bufferLength);

//     function renderFrame() {
//         webAnalyser.getByteFrequencyData(dataArray);

//         // Use `dataArray` to manipulate your Three.js scene
//         console.log(dataArray);

//         requestAnimationFrame(renderFrame);
//     }

//     renderFrame();
// }

// const webListener = new THREE.AudioListener();
// scene.add(webListener);

// const webAudio = new THREE.Audio(webListener);



// const stream = require('youtube-audio-stream');
// async function handleView (req, res) {
//   try {
//     for await (const chunk of stream(`http://youtube.com/watch?v=${req.params.videoId}`)) {
//       res.write(chunk)
//     }
//     res.end()
//   } catch (err) {
//     console.error(err)
//     if (!res.headersSent) {
//       res.writeHead(500)
//       res.end('internal system error')
//     }
//   }
// }

// handleView();