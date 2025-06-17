import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';

// Mock data for testing
const createMockFile = (name: string, size: number = 1024 * 1024) => {
  const file = new File(['mock audio data'], name, { type: 'audio/wav' });
  Object.defineProperty(file, 'size', { value: size });
  return file;
};

describe('App Component', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    console.log = () => {};
    console.warn = () => {};
    console.error = () => {};
  });

  afterEach(() => {
    // Clean up after each test
  });

  describe('Initial Render', () => {
    it('renders the main heading', () => {
      render(<App />);
      expect(screen.getByText('Lufalyze')).toBeInTheDocument();
    });

    it('renders the subtitle', () => {
      render(<App />);
      expect(screen.getByText(/Professional loudness analyzer implementing EBU R 128/)).toBeInTheDocument();
    });

    it('renders the About button', () => {
      render(<App />);
      expect(screen.getByRole('button', { name: /about/i })).toBeInTheDocument();
    });

    it('renders the file upload area', () => {
      render(<App />);
      expect(screen.getByText(/Drop your WAV file here/)).toBeInTheDocument();
      expect(screen.getByText(/or click to browse/)).toBeInTheDocument();
    });

    it('does not show results initially', () => {
      render(<App />);
      expect(screen.queryByText('Loudness Analysis')).not.toBeInTheDocument();
    });
  });

  describe('About Dialog', () => {
    it('shows about dialog when button is clicked', async () => {
      const user = userEvent.setup();
      render(<App />);
      
      const aboutButton = screen.getByRole('button', { name: /about/i });
      await user.click(aboutButton);
      
      expect(screen.getByText('About Lufalyze')).toBeInTheDocument();
      expect(screen.getByText(/Version: 1.0.0/)).toBeInTheDocument();
    });

    it('closes about dialog when close button is clicked', async () => {
      const user = userEvent.setup();
      render(<App />);
      
      // Open dialog
      const aboutButton = screen.getByRole('button', { name: /about/i });
      await user.click(aboutButton);
      
      // Close dialog
      const closeButton = screen.getByRole('button', { name: '' }); // Close button with X icon
      await user.click(closeButton);
      
      expect(screen.queryByText('About Lufalyze')).not.toBeInTheDocument();
    });

    it('displays privacy information in about dialog', async () => {
      const user = userEvent.setup();
      render(<App />);
      
      const aboutButton = screen.getByRole('button', { name: /about/i });
      await user.click(aboutButton);
      
      expect(screen.getByText(/All processing happens locally/)).toBeInTheDocument();
      expect(screen.getByText(/WebAssembly/)).toBeInTheDocument();
    });

    it('displays technical standards in about dialog', async () => {
      const user = userEvent.setup();
      render(<App />);
      
      const aboutButton = screen.getByRole('button', { name: /about/i });
      await user.click(aboutButton);
      
      expect(screen.getByText(/ITU-R BS.1770-4 with proper K-weighting/)).toBeInTheDocument();
      expect(screen.getByText(/Youlean Loudness Meter Pro/)).toBeInTheDocument();
    });
  });

  describe('File Upload Validation', () => {
    it('shows error for non-WAV files', async () => {
      const user = userEvent.setup();
      render(<App />);
      
      const fileInput = screen.getByRole('textbox', { hidden: true }) as HTMLInputElement;
      const file = new File(['test'], 'test.mp3', { type: 'audio/mp3' });
      
      await user.upload(fileInput, file);
      
      await waitFor(() => {
        expect(screen.getByText('Please select a WAV file')).toBeInTheDocument();
      });
    });

    it('shows error for files over 100MB', async () => {
      const user = userEvent.setup();
      render(<App />);
      
      const fileInput = screen.getByRole('textbox', { hidden: true }) as HTMLInputElement;
      const largeFile = createMockFile('large.wav', 101 * 1024 * 1024); // 101MB
      
      await user.upload(fileInput, largeFile);
      
      await waitFor(() => {
        expect(screen.getByText('File size exceeds 100MB limit. Please select a smaller file.')).toBeInTheDocument();
      });
    });

    it('accepts valid WAV files', async () => {
      const user = userEvent.setup();
      render(<App />);
      
      const fileInput = screen.getByRole('textbox', { hidden: true }) as HTMLInputElement;
      const validFile = createMockFile('test.wav', 10 * 1024 * 1024); // 10MB
      
      await user.upload(fileInput, validFile);
      
      await waitFor(() => {
        expect(screen.getByText('test.wav')).toBeInTheDocument();
        expect(screen.getByText('10.0 MB')).toBeInTheDocument();
      });
    });
  });

  describe('Drag and Drop', () => {
    it('highlights drop area when dragging over', async () => {
      render(<App />);
      
      const dropArea = screen.getByText(/Drop your WAV file here/).closest('div');
      
      fireEvent.dragEnter(dropArea!);
      
      // The component should add visual feedback classes
      expect(dropArea).toHaveClass('border-indigo-500');
    });

    it('removes highlight when drag leaves', async () => {
      render(<App />);
      
      const dropArea = screen.getByText(/Drop your WAV file here/).closest('div');
      
      fireEvent.dragEnter(dropArea!);
      fireEvent.dragLeave(dropArea!);
      
      expect(dropArea).not.toHaveClass('border-indigo-500');
    });

    it('handles file drop', async () => {
      render(<App />);
      
      const dropArea = screen.getByText(/Drop your WAV file here/).closest('div');
      const file = createMockFile('dropped.wav');
      
      fireEvent.drop(dropArea!, {
        dataTransfer: {
          files: [file]
        }
      });
      
      await waitFor(() => {
        expect(screen.getByText('dropped.wav')).toBeInTheDocument();
      });
    });
  });

  describe('File Processing', () => {
    it('shows processing state when file is uploaded', async () => {
      const user = userEvent.setup();
      render(<App />);
      
      const fileInput = screen.getByRole('textbox', { hidden: true }) as HTMLInputElement;
      const file = createMockFile('processing.wav');
      
      await user.upload(fileInput, file);
      
      await waitFor(() => {
        expect(screen.getByText('Processing...')).toBeInTheDocument();
      });
    });

    it('shows progress bar during processing', async () => {
      const user = userEvent.setup();
      render(<App />);
      
      const fileInput = screen.getByRole('textbox', { hidden: true }) as HTMLInputElement;
      const file = createMockFile('progress.wav');
      
      await user.upload(fileInput, file);
      
      await waitFor(() => {
        const progressBar = screen.getByRole('progressbar', { hidden: true });
        expect(progressBar).toBeInTheDocument();
      });
    });

    it('displays results after processing completes', async () => {
      const user = userEvent.setup();
      render(<App />);
      
      const fileInput = screen.getByRole('textbox', { hidden: true }) as HTMLInputElement;
      const file = createMockFile('complete.wav');
      
      await user.upload(fileInput, file);
      
      // Wait for mock worker to respond
      await waitFor(() => {
        expect(screen.getByText('Loudness Analysis')).toBeInTheDocument();
      }, { timeout: 2000 });
    });
  });

  describe('Results Display', () => {
    const uploadFileAndWaitForResults = async () => {
      const user = userEvent.setup();
      const fileInput = screen.getByRole('textbox', { hidden: true }) as HTMLInputElement;
      const file = createMockFile('results.wav');
      
      await user.upload(fileInput, file);
      
      await waitFor(() => {
        expect(screen.getByText('Loudness Analysis')).toBeInTheDocument();
      }, { timeout: 2000 });
    };

    it('displays loudness metrics', async () => {
      render(<App />);
      await uploadFileAndWaitForResults();
      
      expect(screen.getByText('Momentary Max')).toBeInTheDocument();
      expect(screen.getByText('Short Term Max')).toBeInTheDocument();
      expect(screen.getByText('Integrated')).toBeInTheDocument();
      expect(screen.getByText('RMS Level')).toBeInTheDocument();
    });

    it('displays platform targets section', async () => {
      render(<App />);
      await uploadFileAndWaitForResults();
      
      expect(screen.getByText('Platform Targets')).toBeInTheDocument();
      expect(screen.getByText('Spotify')).toBeInTheDocument();
      expect(screen.getByText('Apple Music')).toBeInTheDocument();
      expect(screen.getByText('YouTube')).toBeInTheDocument();
    });

    it('displays performance metrics', async () => {
      render(<App />);
      await uploadFileAndWaitForResults();
      
      expect(screen.getByText('Performance Metrics')).toBeInTheDocument();
      expect(screen.getByText('Total Processing')).toBeInTheDocument();
      expect(screen.getByText('K-weighting')).toBeInTheDocument();
      expect(screen.getByText('Block Processing')).toBeInTheDocument();
    });

    it('allows copying results', async () => {
      const user = userEvent.setup();
      render(<App />);
      await uploadFileAndWaitForResults();
      
      const copyButton = screen.getByRole('button', { name: /copy results/i });
      await user.click(copyButton);
      
      await waitFor(() => {
        expect(screen.getByText('Copied!')).toBeInTheDocument();
      });
    });
  });

  describe('Platform Target Selection', () => {
    const uploadFileAndWaitForResults = async () => {
      const user = userEvent.setup();
      const fileInput = screen.getByRole('textbox', { hidden: true }) as HTMLInputElement;
      const file = createMockFile('platform.wav');
      
      await user.upload(fileInput, file);
      
      await waitFor(() => {
        expect(screen.getByText('Platform Targets')).toBeInTheDocument();
      }, { timeout: 2000 });
    };

    it('allows selecting different platforms', async () => {
      const user = userEvent.setup();
      render(<App />);
      await uploadFileAndWaitForResults();
      
      const appleButton = screen.getByRole('button', { name: /apple music/i });
      await user.click(appleButton);
      
      expect(appleButton).toHaveClass('bg-indigo-500');
    });

    it('shows platform details when selected', async () => {
      const user = userEvent.setup();
      render(<App />);
      await uploadFileAndWaitForResults();
      
      const youtubeButton = screen.getByRole('button', { name: /youtube/i });
      await user.click(youtubeButton);
      
      expect(screen.getByText('YouTube')).toBeInTheDocument();
      expect(screen.getByText('Video platform')).toBeInTheDocument();
    });
  });

  describe('Dark Mode', () => {
    it('applies dark mode based on system preference', () => {
      // Mock matchMedia to return dark mode preference
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: (query: string) => ({
          matches: query === '(prefers-color-scheme: dark)',
          media: query,
          onchange: null,
          addListener: () => {},
          removeListener: () => {},
          addEventListener: () => {},
          removeEventListener: () => {},
          dispatchEvent: () => {},
        }),
      });

      render(<App />);
      
      // The component should add dark class to document element
      // This is tested by checking if the class exists
      expect(document.documentElement.classList.contains('dark')).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('displays error messages', async () => {
      const user = userEvent.setup();
      render(<App />);
      
      const fileInput = screen.getByRole('textbox', { hidden: true }) as HTMLInputElement;
      const file = new File(['test'], 'test.txt', { type: 'text/plain' });
      
      await user.upload(fileInput, file);
      
      await waitFor(() => {
        expect(screen.getByText('Please select a WAV file')).toBeInTheDocument();
      });
    });

    it('clears previous errors when new file is uploaded', async () => {
      const user = userEvent.setup();
      render(<App />);
      
      const fileInput = screen.getByRole('textbox', { hidden: true }) as HTMLInputElement;
      
      // Upload invalid file
      const invalidFile = new File(['test'], 'test.txt', { type: 'text/plain' });
      await user.upload(fileInput, invalidFile);
      
      await waitFor(() => {
        expect(screen.getByText('Please select a WAV file')).toBeInTheDocument();
      });
      
      // Upload valid file
      const validFile = createMockFile('valid.wav');
      await user.upload(fileInput, validFile);
      
      await waitFor(() => {
        expect(screen.queryByText('Please select a WAV file')).not.toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA labels', () => {
      render(<App />);
      
      const fileInput = screen.getByLabelText(/browse/i, { selector: 'input' });
      expect(fileInput).toHaveAttribute('type', 'file');
      expect(fileInput).toHaveAttribute('accept', 'audio/wav,.wav');
    });

    it('supports keyboard navigation', async () => {
      const user = userEvent.setup();
      render(<App />);
      
      const aboutButton = screen.getByRole('button', { name: /about/i });
      
      await user.tab();
      expect(aboutButton).toHaveFocus();
    });
  });
}); 