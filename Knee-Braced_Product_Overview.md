# Knee-Braced Product Overview

## Product Name
Knee-Braced (also referenced in setup materials as PhysioTrack)

## What the Product Is
Knee-Braced is a digital rehabilitation platform for physiotherapy teams and their patients.  
It combines patient management, exercise assignment, live sensor-based tracking (Arduino integration), and cloud-backed progress records in one system.

The product is designed to support both clinical workflows and at-home rehabilitation by allowing physiotherapists to monitor patient activity and by helping patients follow assigned recovery exercises with real-time guidance data.

## Target Users
- Physiotherapists and rehabilitation clinicians
- Patients undergoing knee rehabilitation programs
- Care teams that need remote progress visibility

## Core Product Modules
- Web application frontend (`React + TypeScript`)
- Backend API and app server (`Express + TypeScript`)
- Shared data schema layer
- Firebase-backed authentication and cloud data workflows
- Optional ML service module for future analytics/intelligence extensions

## Main Features Included

### 1) User Authentication and Access
- Email/password sign-up and login
- Role-based access patterns for physiotherapist and patient experiences
- Protected app routing for authenticated access

### 2) Physiotherapist Dashboard
- View and manage assigned patients
- Review patient status and activity
- Access dialogs to assign patients and exercises
- Monitor incoming rehabilitation readings

### 3) Patient Dashboard
- View assigned rehabilitation exercises
- Track exercise progress from a patient-facing interface
- Connect to external sensor hardware for live data capture

### 4) Exercise Management
- Exercise creation and assignment flows
- Exercise cards and status display components
- Structured workflow for physiotherapist-to-patient exercise delivery

### 5) Live Device Integration (Arduino)
- Dedicated Arduino connection hook for browser-based serial communication
- Connection state and status handling in the UI
- Live reading capture for rehabilitation events

### 6) Real-Time/Cloud Data Pipeline
- Backend route handling for app API operations
- Proxy endpoint integration for n8n webhook workflow calls
- Cloud function deployment path for event-driven processing
- Firestore integration for persistent patient and reading data

### 7) Progress and Reporting Foundations
- Readings/events model for recording rehabilitation activity
- UI components ready for progress visualization and status communication
- Existing PDF generation dependency support for report workflows

### 8) Modern UI System
- Component-based UI architecture using reusable design primitives
- Responsive layouts with dashboard-oriented navigation
- Toasts, dialogs, cards, badges, and form components for rich interactions

## Technology Stack
- Frontend: React, TypeScript, Vite, Tailwind CSS, Radix UI
- Backend: Express, TypeScript, Node.js
- Data/Auth: Firebase Authentication, Firestore
- Integrations: Arduino (Web Serial), n8n webhook pipeline
- Optional modules: ML service (Python), serverless functions

## Product Value
- Enables remote and in-clinic knee rehabilitation tracking
- Improves physiotherapist visibility into patient adherence and performance
- Reduces manual follow-up overhead through centralized digital workflows
- Builds a foundation for advanced analytics, alerts, and personalized therapy recommendations

## Current Scope and Roadmap Readiness
Based on the current codebase and deployment guides, the platform already supports core multi-role workflows and device-connected data collection.  
The architecture is also ready for incremental upgrades such as richer analytics, notifications, and deeper exercise programming.

## Deliverable Summary
Knee-Braced is a rehabilitation product that connects clinicians and patients through:
- Role-based web dashboards
- Exercise assignment and monitoring
- Live Arduino-assisted rehabilitation readings
- Cloud-integrated storage and workflow automation

This creates a practical, extensible product for data-driven knee recovery management.
