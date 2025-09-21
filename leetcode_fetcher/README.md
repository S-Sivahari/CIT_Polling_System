# LeetCode Staff Portal

A responsive React TypeScript web application for staff to manage and fetch LeetCode data for students in their department and section.

## Features

- **Staff Authentication**: Secure login system with department and section-based access
- **Student Management**: View students assigned to specific department and section
- **LeetCode Data Fetching**: Fetch comprehensive LeetCode statistics for multiple students
- **Configurable Data Options**: Choose which data fields to include in the fetch
- **CSV Export**: Download fetched data in CSV format for analysis
- **Responsive Design**: Mobile-friendly interface that works on all devices
- **Real-time Progress**: Visual progress tracking during data fetching

## Demo Credentials

Use these credentials to test the application:

- **Username**: `staff1`, **Password**: `password123` (Computer Science, Section A)
- **Username**: `staff2`, **Password**: `password123` (Information Technology, Section B)
- **Username**: `staff3`, **Password**: `password123` (Computer Science, Section B)

## Installation

1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd leetcode-staff-portal
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Start the development server**:
   ```bash
   npm start
   ```

4. **Open your browser** and navigate to `http://localhost:3000`

## Available Scripts

- `npm start` - Runs the app in development mode
- `npm run build` - Builds the app for production
- `npm test` - Launches the test runner
- `npm run eject` - Ejects from Create React App (one-way operation)

## Project Structure

```
src/
├── components/          # React components
│   ├── Login.tsx       # Authentication component
│   ├── Dashboard.tsx   # Main dashboard interface
│   ├── StudentList.tsx # Student display component
│   └── FetchOptionsDialog.tsx # Data fetching dialog
├── services/           # API and data services
│   ├── mockData.ts     # Mock data for demonstration
│   └── leetcodeService.ts # LeetCode API integration
├── types/              # TypeScript type definitions
│   └── index.ts        # All application types
├── utils/              # Utility functions
│   └── csvExport.ts    # CSV export functionality
└── App.tsx             # Main application component
```

## How It Works

### 1. Authentication
- Staff members log in with their credentials
- System validates credentials and determines department/section access
- Redirects to dashboard upon successful authentication

### 2. Dashboard
- Displays staff's department and section information
- Shows list of students assigned to that department/section
- Provides action buttons for data fetching and configuration

### 3. Data Fetching
- Click "Fetch LeetCode Data" to start collecting student data
- Configure which data fields to include (profile, stats, contest, badges, ranking)
- System fetches data from LeetCode GraphQL API for each student
- Real-time progress tracking with visual indicators

### 4. Data Export
- View fetched data in the results panel
- Download complete dataset as CSV file
- CSV includes only the selected data fields

## Data Fields Available

### Profile Information
- Username, Real Name, Company, School, Country
- Global Ranking, Reputation, Skill Tags

### Problem Statistics
- Total problems solved
- Easy/Medium/Hard problems solved
- Performance percentiles for each difficulty

### Contest Data
- Contest rating and global ranking
- Number of contests attended
- Top percentage ranking

### Badges
- Contest badges and earned badges
- Badge creation dates and descriptions

## Technical Details

- **Frontend**: React 18 with TypeScript
- **UI Framework**: Material-UI (MUI) v5
- **Routing**: React Router v6
- **State Management**: React Hooks
- **API Integration**: Fetch API with GraphQL
- **Data Export**: PapaParse for CSV generation
- **Responsive Design**: Material-UI breakpoints and mobile-first approach

## API Integration

The application integrates with LeetCode's GraphQL API to fetch:
- User profile information
- Problem-solving statistics
- Contest participation data
- Badge information

## Customization

### Adding New Staff Members
Edit `src/services/mockData.ts` to add new staff credentials and department assignments.

### Adding New Students
Add student records to the `mockStudents` array in the same file.

### Modifying Data Fields
Update the `FetchOptions` interface in `src/types/index.ts` to add new data field options.

## Browser Compatibility

- Chrome (recommended)
- Firefox
- Safari
- Edge

## Performance Considerations

- Rate limiting protection (100ms delay between API calls)
- Progressive data loading with progress indicators
- Efficient CSV generation for large datasets
- Responsive design optimized for mobile devices

## Troubleshooting

### Common Issues

1. **API Rate Limiting**: If you encounter rate limiting, increase the delay in `FetchOptionsDialog.tsx`
2. **CORS Issues**: The application uses LeetCode's public GraphQL API which should not have CORS restrictions
3. **Mobile Display**: Ensure you're using the latest version of your mobile browser

### Development Issues

1. **TypeScript Errors**: Run `npm run build` to check for type errors
2. **Dependency Issues**: Delete `node_modules` and run `npm install` again
3. **Build Errors**: Clear browser cache and restart the development server

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is licensed under the MIT License.

## Support

For issues and questions, please create an issue in the repository or contact the development team.
