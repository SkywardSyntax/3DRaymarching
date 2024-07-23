# Raytracing Fractal Demo with WebGL

Welcome to the raytracing fractal demo implemented with WebGL! This project showcases a fractal rendered using raytracing techniques in a WebGL context.

## Description

This project demonstrates a raytracing fractal demo using WebGL. The fractal is rendered in real-time on a canvas element, providing an interactive and visually appealing experience.

## Running the Application

To run this application, follow these steps:

1. Install the dependencies:
   ```
   npm install
   ```

2. Start the development server:
   ```
   npm run dev
   ```

3. Open your browser and navigate to `http://localhost:3000` to view the demo.

## Zoom Functionality

You can zoom in and out of the fractal using the mouse wheel. Scroll up to zoom in and scroll down to zoom out.

## Light Source Indicator and Improved Shadows

This project now includes a visible indicator for the location of the light source when casting shadows. The indicator is a small sphere rendered at the light source position.

Additionally, the shadow rendering algorithm has been improved to use a more sophisticated approach, combining soft shadows and ambient occlusion for more realistic results.

## Horizontal Rotation Control

You can now rotate the rough sphere horizontally using a slider on a frosted glass chip. The slider is located at the bottom of the screen. Adjust the slider to rotate the sphere without deforming it.
