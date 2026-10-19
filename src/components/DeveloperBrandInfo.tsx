import React from 'react';

export const DEVELOPER_INFO = {
  company: 'BASOBASO SOFTWARES',
  email: 'baseramarlvin@gmail.com',
  phoneDisplay: '0788123047',
  whatsappIntl: '263788123047',
  linkedInName: 'Marlvin Basera',
  linkedInUrl: 'https://www.linkedin.com/in/marlvin-basera-359939286',
  version: 'v1.0.0',
};

/**
 * Modern Branded SVG Icons for LinkedIn, WhatsApp, Email, and Direct Call
 */
export const ModernLinkedInIcon: React.FC<{ className?: string }> = ({
  className = 'w-5 h-5',
}) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden="true"
  >
    <rect width="24" height="24" rx="6" fill="#0A66C2" />
    <path
      d="M7.12 9.75H4.63V18H7.12V9.75ZM5.88 8.62C6.68 8.62 7.32 7.97 7.32 7.17C7.32 6.37 6.68 5.73 5.88 5.73C5.07 5.73 4.43 6.37 4.43 7.17C4.43 7.97 5.07 8.62 5.88 8.62ZM19.57 18H17.09V13.98C17.09 13.02 17.07 11.79 15.79 11.79C14.49 11.79 14.29 12.83 14.29 13.91V18H11.81V9.75H14.19V10.88H14.22C14.55 10.24 15.36 9.55 16.58 9.55C19.1 9.55 19.57 11.24 19.57 13.44V18Z"
      fill="#FFFFFF"
    />
  </svg>
);

export const ModernWhatsAppIcon: React.FC<{ className?: string }> = ({
  className = 'w-5 h-5',
}) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden="true"
  >
    <rect width="24" height="24" rx="6" fill="#16A34A" />
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M12.01 4.5C7.87 4.5 4.51 7.85 4.51 11.98C4.51 13.39 4.9 14.76 5.65 15.95L4.5 19.5L8.18 18.38C9.33 19.05 10.66 19.41 12.01 19.41C16.15 19.41 19.5 16.06 19.5 11.93C19.5 7.8 16.15 4.5 12.01 4.5ZM15.56 14.66C15.41 15.08 14.68 15.48 14.32 15.53C13.99 15.58 13.57 15.6 13.11 15.45C12.83 15.36 12.46 15.24 11.99 15.04C10.02 14.19 8.74 12.22 8.64 12.09C8.54 11.96 7.84 11.03 7.84 10.07C7.84 9.11 8.34 8.64 8.52 8.45C8.7 8.26 8.91 8.21 9.04 8.21C9.17 8.21 9.3 8.21 9.41 8.22C9.53 8.23 9.69 8.17 9.85 8.55C10.01 8.94 10.4 9.9 10.45 10C10.5 10.1 10.53 10.21 10.46 10.34C10.39 10.47 10.36 10.55 10.26 10.67C10.16 10.79 10.05 10.93 9.96 11.02C9.86 11.12 9.76 11.23 9.87 11.42C9.98 11.61 10.37 12.25 10.95 12.76C11.7 13.43 12.32 13.64 12.51 13.73C12.7 13.83 12.81 13.81 12.93 13.68C13.05 13.55 13.43 13.1 13.56 12.91C13.69 12.72 13.82 12.75 14 12.82C14.18 12.89 15.14 13.36 15.34 13.46C15.54 13.56 15.67 13.61 15.72 13.69C15.77 13.78 15.71 14.24 15.56 14.66Z"
      fill="#FFFFFF"
    />
  </svg>
);

export const ModernEmailIcon: React.FC<{ className?: string }> = ({
  className = 'w-5 h-5',
}) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden="true"
  >
    <rect width="24" height="24" rx="6" fill="#D97706" />
    <path
      d="M5.75 7.25C5.06 7.25 4.5 7.81 4.5 8.5V15.5C4.5 16.19 5.06 16.75 5.75 16.75H18.25C18.94 16.75 19.5 16.19 19.5 15.5V8.5C19.5 7.81 18.94 7.25 18.25 7.25H5.75ZM6.35 8.75H17.65L12 12.52L6.35 8.75ZM6 10.32L11.58 14.04C11.83 14.21 12.17 14.21 12.42 14.04L18 10.32V15.25H6V10.32Z"
      fill="#FFFFFF"
    />
  </svg>
);

export const ModernPhoneIcon: React.FC<{ className?: string }> = ({
  className = 'w-5 h-5',
}) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden="true"
  >
    <rect width="24" height="24" rx="6" fill="#0F172A" />
    <path
      d="M8.38 5.5H6.62C6 5.5 5.5 6 5.5 6.62C5.5 13.18 10.82 18.5 17.38 18.5C18 18.5 18.5 18 18.5 17.38V15.62C18.5 15.09 18.13 14.63 17.61 14.52L15.17 14.03C14.72 13.94 14.25 14.11 13.96 14.47L13.12 15.5C10.95 14.41 9.59 13.05 8.5 10.88L9.53 10.04C9.89 9.75 10.06 9.28 9.97 8.83L9.48 6.39C9.37 5.87 8.91 5.5 8.38 5.5Z"
      fill="#FFFFFF"
    />
  </svg>
);
