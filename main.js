document.addEventListener('DOMContentLoaded', () => {
    // Module aliases
    const {
        Engine, Render, Runner, Bodies, Composite, Events, Body
    } = Matter;

    // Get DOM elements
    const container = document.getElementById('game-container');
    const canvas = document.getElementById('pinball-canvas');
    const scoreElement = document.getElementById('score');
    const overlay = document.getElementById('overlay');
    const overlayTitle = document.getElementById('overlay-title');
    const overlayText = document.getElementById('overlay-text');
    const startButton = document.getElementById('start-button');

    let score = 0;
    let isGameRunning = false;

    // --- Engine and Renderer Setup ---
    const engine = Engine.create();
    const world = engine.world;
    engine.world.gravity.y = 1;

    const render = Render.create({
        canvas: canvas,
        engine: engine,
        options: {
            width: container.clientWidth,
            height: container.clientHeight,
            wireframes: false,
            background: 'transparent',
        }
    });
    const runner = Runner.create();

    // --- Ball Trail Effect ---
    let trail = [];
    Events.on(render, 'afterRender', () => {
        const ctx = render.context;
        for (let i = 0; i < trail.length; i++) {
            const point = trail[i];
            ctx.fillStyle = `rgba(0, 255, 255, ${point.opacity})`;
            ctx.beginPath();
            ctx.arc(point.x, point.y, point.radius, 0, 2 * Math.PI);
            ctx.fill();
        }
    });

    Events.on(engine, 'afterUpdate', () => {
        if (isGameRunning) {
            trail.push({ x: ball.position.x, y: ball.position.y, radius: ball.circleRadius * 0.8, opacity: 1 });
        }
        for (let i = 0; i < trail.length; i++) {
            trail[i].opacity -= 0.05;
            trail[i].radius -= 0.2;
        }
        trail = trail.filter(point => point.opacity > 0 && point.radius > 0);
    });

    // --- Create Game Elements ---
    const ball = Bodies.circle(container.clientWidth - 35, container.clientHeight - 50, 10, {
        restitution: 0.4, // Reduced bounciness
        render: { fillStyle: '#00ffff' }, 
        label: 'ball'
    });

    const flipperGroup = Body.nextGroup(true);
    const flipperOptions = { isStatic: true, render: { fillStyle: '#ff00ff' }, collisionFilter: { group: flipperGroup } };
    const leftFlipper = Bodies.rectangle(container.clientWidth * 0.3, container.clientHeight - 120, 80, 15, { label: 'leftFlipper', ...flipperOptions, angle: Math.PI / 6 });
    const rightFlipper = Bodies.rectangle(container.clientWidth * 0.7, container.clientHeight - 120, 80, 15, { label: 'rightFlipper', ...flipperOptions, angle: -Math.PI / 6 });

    const bumperOptions = { isStatic: true, restitution: 1.2, label: 'bumper', render: { fillStyle: '#ffff00' } }; // Slightly reduced bumper restitution
    const bumpers = [
        Bodies.circle(container.clientWidth / 2, 100, 20, bumperOptions),
        Bodies.circle(container.clientWidth * 0.25, 200, 20, bumperOptions),
        Bodies.circle(container.clientWidth * 0.75, 200, 20, bumperOptions),
        Bodies.circle(container.clientWidth / 2, 300, 20, bumperOptions),
    ];

    const wallOptions = { isStatic: true, render: { fillStyle: '#ff00ff' }, restitution: 0.2 }; // Reduced wall restitution
    const walls = [
        Bodies.rectangle(container.clientWidth / 2, -10, container.clientWidth, 20, { ...wallOptions }),
        Bodies.rectangle(-10, container.clientHeight / 2, 20, container.clientHeight, { ...wallOptions }),
        Bodies.rectangle(container.clientWidth + 10, container.clientHeight / 2, 20, container.clientHeight, { ...wallOptions }),
        Bodies.rectangle(container.clientWidth / 2, container.clientHeight + 10, container.clientWidth, 20, { isStatic: true, isSensor: true, label: 'gameOverSensor' }),
        Bodies.rectangle(container.clientWidth - 50, container.clientHeight / 2 + 50, 10, container.clientHeight, { ...wallOptions }),
        Bodies.rectangle(container.clientWidth - 25, container.clientHeight - 20, 50, 10, { ...wallOptions }),
        Bodies.rectangle(container.clientWidth * 0.15, container.clientHeight - 50, 120, 10, { ...wallOptions, angle: Math.PI / 4 }),
        Bodies.rectangle(container.clientWidth * 0.85, container.clientHeight - 50, 120, 10, { ...wallOptions, angle: -Math.PI / 4 }),
    ];

    Composite.add(world, [ball, leftFlipper, rightFlipper, ...bumpers, ...walls]);

    // --- Controls ---
    const flip = (flipper, isFlipping) => {
        if (!isGameRunning) return;
        const flipAngle = Math.PI / 4;
        const newAngle = flipper.label === 'leftFlipper' ? -flipAngle : flipAngle;
        const restingAngle = flipper.label === 'leftFlipper' ? Math.PI / 6 : -Math.PI / 6;
        Body.setAngle(flipper, isFlipping ? newAngle : restingAngle);
    };

    document.addEventListener('keydown', (e) => {
        if (e.code === 'ArrowLeft') flip(leftFlipper, true);
        if (e.code === 'ArrowRight') flip(rightFlipper, true);
        if (e.code === 'Space') launchBall();
    });

    document.addEventListener('keyup', (e) => {
        if (e.code === 'ArrowLeft') flip(leftFlipper, false);
        if (e.code === 'ArrowRight') flip(rightFlipper, false);
    });

    const launchBall = () => {
        if (isGameRunning && ball.position.x > container.clientWidth - 50 && ball.velocity.y > -1) {
            Body.setVelocity(ball, { x: 0, y: -25 }); // Adjusted launch velocity
        }
    };

    // --- Collision and Scoring ---
    Events.on(engine, 'collisionStart', (event) => {
        if (!isGameRunning) return;
        event.pairs.forEach((pair) => {
            const { bodyA, bodyB } = pair;
            if (bodyA.label === 'ball' || bodyB.label === 'ball') {
                if (bodyA.label === 'gameOverSensor' || bodyB.label === 'gameOverSensor') {
                    gameOver();
                } else {
                    const bumper = bodyA.label === 'bumper' ? bodyA : (bodyB.label === 'bumper' ? bodyB : null);
                    if (bumper) {
                        updateScore(100);
                        bumper.render.fillStyle = '#ffffff';
                        setTimeout(() => { bumper.render.fillStyle = '#ffff00'; }, 100);
                    }
                }
            }
        });
    });

    // --- Game State Management ---
    function showOverlay(title, text, buttonText) {
        overlay.style.display = 'flex';
        overlayTitle.innerText = title;
        overlayText.innerHTML = text;
        startButton.innerText = buttonText;
    }

    function hideOverlay() {
        overlay.style.display = 'none';
    }

    function startGame() {
        isGameRunning = true;
        hideOverlay();
        updateScore(0, true);
        
        Body.setStatic(ball, false);
        Body.setPosition(ball, { x: container.clientWidth - 25, y: container.clientHeight - 50 });
        Body.setVelocity(ball, { x: 0, y: 0 });

        Runner.run(runner, engine);
        Render.run(render);
    }

    function gameOver() {
        isGameRunning = false;
        Runner.stop(runner);
        showOverlay('GAME OVER', `Your Final Score: ${score}`, 'RESTART');
    }

    function resetGame() {
        isGameRunning = false; // Set to false before starting
        Body.setAngle(leftFlipper, Math.PI / 6);
        Body.setAngle(rightFlipper, -Math.PI / 6);
        trail = [];
        startGame();
    }

    function updateScore(points, reset = false) {
        score = reset ? 0 : score + points;
        scoreElement.innerHTML = `SCORE: ${score}`;
    }

    // --- Initial Setup ---
    startButton.addEventListener('click', () => {
        if (!isGameRunning) {
             resetGame();
        }
    });

    showOverlay('HTML5 PINBALL', 'Use Left/Right arrow keys to control flippers.<br>Press SPACE to launch the ball.', 'START GAME');
    scoreElement.innerHTML = "SCORE: 0";
    Body.setStatic(ball, true);
    Body.setPosition(ball, {x: -100, y: -100}); 
});
