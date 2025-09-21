# 🗳️ CIT Polling System

A comprehensive real-time polling system designed specifically for Chennai Institute of Technology (CIT) with multi-role access, advanced scheduling features, and comprehensive analytics.

## 🌟 Features

### 🔐 **Multi-Role Authentication System**
- **Student Dashboard**: Participate in polls, view results, and track attendance
- **Faculty Dashboard**: Create polls, manage students, and view analytics
- **HOD Dashboard**: Comprehensive management across multiple sections
- **Google OAuth Integration**: Secure login with @citchennai.net email validation

### 📊 **Advanced Poll Management**
- **Multiple Poll Types**: General polls, attendance tracking, hackathon participation, G-Form integration, problems solved tracking
- **Scheduled Polling**: Create polls ahead of time with automatic publication
- **Gender-Specific Targeting**: Target polls to specific gender groups (all/boys/girls)
- **Real-time Updates**: Live poll responses with instant notifications
- **Auto-deletion**: Configurable automatic poll cleanup (1-2 days)
- **Deadline Management**: Set deadlines with automatic expiration

### 📈 **Analytics & Reporting**
- **Response Analytics**: Real-time tracking of poll participation
- **Export Capabilities**: Excel export with multiple sheets (responded/not responded)
- **Student Management**: Track individual student participation and patterns
- **LeetCode Integration**: Fetch and manage LeetCode contest data

### 🎨 **Modern User Experience**
- **Responsive Design**: Mobile-first approach with optimized layouts
- **Dark Theme**: Professional dark mode interface
- **Animations**: Smooth Framer Motion transitions
- **Real-time Toast Notifications**: Instant feedback for all actions
- **Progressive Enhancement**: Works across all devices and browsers

### 🔧 **Administrative Features**
- **Role-based Access Control**: Secure permissions system
- **Department & Section Management**: Organize by academic structure
- **Real-time Subscriptions**: Live updates using Supabase realtime
- **Bulk Operations**: Mass student management and data export
- **Advanced Filtering**: Search and filter by multiple criteria

## 🛠️ Technology Stack

### **Frontend**
- **Next.js 14** - React framework with App Router
- **TypeScript** - Type-safe development
- **Tailwind CSS** - Utility-first styling
- **Framer Motion** - Smooth animations
- **Lucide React** - Beautiful icons

### **Backend & Database**
- **Supabase** - PostgreSQL database with real-time capabilities
- **Next Auth** - Authentication and session management
- **Row Level Security (RLS)** - Database-level security

### **Development Tools**
- **ESLint** - Code linting
- **PostCSS** - CSS processing
- **TypeScript Compiler** - Type checking

## 🚀 Quick Start

### Prerequisites
- **Node.js** 18.0.0 or higher
- **npm** 8.0.0 or higher
- **Supabase Account** for database and authentication

### 1. Clone & Install
```bash
git clone https://github.com/your-username/cit-polling-system.git
cd cit-polling-system
npm install
```

### 2. Environment Configuration
Create `.env.local` in the project root:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Google OAuth Configuration
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# NextAuth Configuration
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-nextauth-secret

# Application Configuration
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_APP_NAME="CIT Polling System"
```

### 3. Database Setup
Run the provided SQL schema in your Supabase SQL editor to create the necessary tables:

- `students` - Student information and registration details
- `staffs` - Faculty and HOD information
- `classes` - Department and section organization
- `polls` - Poll data with scheduling and targeting options
- `poll_responses` - Student responses to polls

### 4. Development Server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to access the application.

## 📁 Project Structure

```
cit-polling-system/
├── app/                          # Next.js App Router
│   ├── api/                      # API routes
│   │   ├── auth/                 # NextAuth endpoints
│   │   ├── cleanup-polls/        # Auto-deletion service
│   │   └── leetcode/             # LeetCode integration
│   ├── faculty/                  # Faculty-specific pages
│   │   ├── dashboard/            # Faculty dashboard
│   │   └── login/                # Faculty login
│   ├── hod/                      # HOD-specific pages
│   │   ├── dashboard/            # HOD dashboard
│   │   └── login/                # HOD login
│   ├── student/                  # Student-specific pages
│   │   ├── dashboard/            # Student dashboard
│   │   └── login/                # Student login
│   ├── globals.css               # Global styles
│   ├── layout.tsx                # Root layout
│   └── page.tsx                  # Home page
├── components/                   # Reusable components
│   ├── AuthProvider.tsx          # Authentication context
│   ├── LeetCodeFetchDialog.tsx   # LeetCode data fetching
│   └── LeetCodeFetcher.tsx       # LeetCode utilities
├── lib/                          # Utility libraries
│   ├── auth.ts                   # NextAuth configuration
│   ├── supabase.ts               # Supabase client
│   └── utils.ts                  # Helper functions
├── types/                        # TypeScript definitions
│   ├── next-auth.d.ts            # NextAuth type extensions
│   └── student.ts                # Student type definitions
└── leetcode_fetcher/             # LeetCode integration module
```

## 🎯 Key Features in Detail

### Scheduled Polling System
- **Future Publication**: Create polls that automatically become visible at scheduled times
- **Visual Indicators**: Clear scheduling status with countdown timers
- **Flexible Timing**: Set both date and specific time for poll publication
- **Auto-Management**: Polls appear and disappear automatically based on schedule

### Role-Based Dashboards

#### **Student Dashboard**
- View available polls filtered by gender targeting
- Participate in real-time polls with instant feedback
- Track personal response history
- Access LeetCode contest information

#### **Faculty Dashboard**
- Create and manage polls for assigned sections
- Schedule polls for future publication
- Export student data and poll responses
- Real-time analytics and response tracking
- LeetCode data management for students

#### **HOD Dashboard**
- Comprehensive view across all department sections
- Bulk poll creation for multiple sections
- Advanced analytics and cross-section reporting
- Department-wide student management

### Poll Types & Templates
1. **Attendance Tracking** - LeetCode Weekly/Biweekly contests
2. **CodeChef Attendance** - CodeChef contest participation
3. **Problems Solved** - Track coding problem completion (0-4+ problems)
4. **General Polls** - Custom questions and options
5. **Hackathon Participation** - Event participation tracking
6. **G-Form Integration** - Link to Google Forms for detailed surveys

## 🔧 Available Scripts

```bash
# Development
npm run dev              # Start development server
npm run build            # Build for production
npm start               # Start production server

# Code Quality
npm run lint            # Run ESLint
npm run lint:fix        # Auto-fix ESLint issues
npm run type-check      # TypeScript type checking
```

## 🚀 Deployment

### Vercel (Recommended)
1. Connect your GitHub repository to Vercel
2. Configure environment variables in Vercel dashboard
3. Deploy automatically on push to main branch

### Manual Deployment
```bash
npm run build
npm start
```

### Environment Variables for Production
Ensure all environment variables are properly set in your hosting platform:
- Supabase credentials
- Google OAuth credentials
- NextAuth configuration
- Production domain URLs

## 🔒 Security Features

- **Email Domain Validation**: Restricts access to @citchennai.net emails
- **Role-Based Access Control**: Strict permission system
- **Session Management**: Secure JWT-based sessions
- **Database Security**: Row Level Security (RLS) policies
- **Input Validation**: Comprehensive form validation and sanitization

## 📱 Mobile Optimization

- **Responsive Design**: Mobile-first CSS approach
- **Touch-Friendly Interface**: Optimized button sizes (44px minimum)
- **Progressive Web App**: Installable on mobile devices
- **Offline Capabilities**: Core functionality works offline
- **Performance Optimized**: Fast loading on mobile networks

## 🤝 Contributing

This is a private educational project for Chennai Institute of Technology. For internal development:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📞 Support & Documentation

### Common Issues
1. **Authentication Errors**: Verify Google OAuth credentials and email domain
2. **Database Connection**: Check Supabase URL and API keys
3. **Build Errors**: Ensure Node.js version compatibility (18+)
4. **Mobile Layout**: Clear browser cache and test viewport settings

### Getting Help
- Check the [Issues](https://github.com/your-username/cit-polling-system/issues) page
- Contact the development team
- Review Supabase and Next.js documentation

## 📄 License

This project is proprietary and confidential.

## 🎉 Acknowledgments

- **Chennai Institute of Technology** - For the educational opportunity
- **Next.js Team** - For the excellent React framework
- **Supabase Team** - For the powerful backend platform
- **Tailwind CSS** - For the utility-first CSS framework
- **Contributors** - Everyone who helped build this system

---

**Made with ❤️ for Chennai Institute of Technology Students and Faculty**