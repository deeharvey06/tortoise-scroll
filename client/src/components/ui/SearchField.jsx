import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import SearchIcon from '@mui/icons-material/SearchOutlined';

export default function SearchField({ label = 'Search', placeholder = 'Search', inputRef, ...props }) {
  return (
    <TextField
      {...props}
      inputRef={inputRef}
      size={props.size || 'small'}
      label={label}
      placeholder={placeholder}
      InputProps={{
        startAdornment: <InputAdornment position="start"><SearchIcon sx={{ fontSize: 18 }} /></InputAdornment>,
        ...props.InputProps,
      }}
    />
  );
}
