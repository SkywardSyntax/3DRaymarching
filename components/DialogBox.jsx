import { createSignal, onCleanup, onMount } from 'solid-js';

function DialogBox() {
  const [isVisible, setIsVisible] = createSignal(true);

  const handleClose = () => {
    setIsVisible(false);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('isFirstTimeUser', 'false');
    }
  };

  onMount(() => {
    if (typeof localStorage !== 'undefined') {
      const isFirstTimeUser = localStorage.getItem('isFirstTimeUser');
      if (isFirstTimeUser === 'false') {
        setIsVisible(false);
      }
    }
  });

  onCleanup(() => {
    // Cleanup if necessary
  });

  return (
    isVisible() && (
      <div className="dialogue-box">
        <h2>Welcome to the 3D Raymarching Project!</h2>
        <p>This project showcases a fractal rendered using raytracing techniques in a WebGL context.</p>
        <p>Use the arrow keys to control the rotation and roughness of the sphere.</p>
        <button onClick={handleClose}>Got it!</button>
      </div>
    )
  );
}

export default DialogBox;
