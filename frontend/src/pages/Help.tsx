import React, { useMemo, useState } from 'react';
import { useBackNavigation } from '../hooks/useBackNavigation';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  IconButton,
  InputAdornment,
  Link,
  List,
  ListItem,
  Paper,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import SearchIcon from '@mui/icons-material/Search';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import { useMobileHeader } from '../contexts/MobileHeaderContext';

import { helpSections } from './helpContent';

const Help: React.FC = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [search, setSearch] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const goBack = useBackNavigation('/');

  useMobileHeader({
    title: 'Помощь',
    onBack: goBack,
    searchOpen: showSearch,
    searchValue: search,
    searchPlaceholder: 'Поиск по инструкциям',
    onSearchOpen: () => setShowSearch(true),
    onSearchClose: () => { setSearch(''); setShowSearch(false); },
    onSearchChange: (v) => setSearch(v),
  });

  const filteredSections = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('ru-RU');

    if (!query) {
      return helpSections;
    }

    return helpSections
      .map((section) => ({
        ...section,
        guides: section.guides.filter((guide) => {
          const searchableText = [guide.title, ...guide.keywords, ...guide.steps]
            .join(' ')
            .toLocaleLowerCase('ru-RU');
          return searchableText.includes(query);
        }),
      }))
      .filter((section) => section.guides.length > 0);
  }, [search]);

  return (
    <Box sx={{ mt: -1.5, maxWidth: 1000, mx: 'auto', width: '100%' }}>
      {!isMobile && (
        <Box sx={{ mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <IconButton onClick={goBack} sx={{ mr: 1, bgcolor: 'rgba(0,0,0,0.06)', '&:hover': { bgcolor: 'rgba(0,0,0,0.10)' } }} aria-label="В главное меню">
              <ArrowBackIcon />
            </IconButton>
            <Typography variant="h4" sx={{ flexGrow: 1 }}>Помощь</Typography>
          </Box>
          <TextField
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Поиск по инструкциям"
            variant="outlined"
            size="small"
            fullWidth
            InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon color="action" /></InputAdornment> }}
          />
        </Box>
      )}

      {filteredSections.length > 0 ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {filteredSections.map((section) => (
            <Accordion
              key={section.title}
              defaultExpanded={!isMobile}
              disableGutters
              elevation={1}
              sx={{
                overflow: 'hidden',
                border: '1px solid #e3edf8',
                borderRadius: '10px !important',
                '&:before': { display: 'none' },
              }}
            >
              <AccordionSummary
                expandIcon={<ExpandMoreIcon />}
                sx={{ minHeight: 64, px: { xs: 2, md: 2.5 }, '& .MuiAccordionSummary-content': { alignItems: 'center', gap: 1.5, my: 1.5 } }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 38, height: 38, flexShrink: 0, borderRadius: 2, bgcolor: '#e3f2fd', color: '#1976d2' }}>
                  {section.icon}
                </Box>
                <Typography variant="h6" sx={{ color: '#04164b', fontWeight: 700 }}>
                  {section.title}
                </Typography>
              </AccordionSummary>
              <AccordionDetails sx={{ px: { xs: 1.5, md: 2.5 }, pb: 2 }}>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {section.guides.map((guide) => (
                    <Accordion key={guide.title} disableGutters elevation={0} sx={{ border: '1px solid #e0e0e0', borderRadius: '8px !important', '&:before': { display: 'none' } }}>
                      <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ px: { xs: 1.5, md: 2 }, '& .MuiAccordionSummary-content': { my: 1.25 } }}>
                        <Typography variant="subtitle1" sx={{ fontWeight: 600, color: '#173b6c' }}>
                          {guide.title}
                        </Typography>
                      </AccordionSummary>
                      <AccordionDetails sx={{ bgcolor: '#f8fbff', px: { xs: 1.5, md: 2.5 }, py: 1.5 }}>
                        <List component="ol" disablePadding sx={{ listStyleType: 'decimal', pl: 2.5 }}>
                          {guide.steps.map((step) => (
                            <ListItem key={step} component="li" disableGutters sx={{ display: 'list-item', pl: 0.75, py: 0.5 }}>
                              <Typography variant="body2" sx={{ lineHeight: 1.6 }}>
                                {step}
                              </Typography>
                            </ListItem>
                          ))}
                        </List>
                        {guide.links && guide.links.length > 0 && (
                          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 1.25, mt: 1.5 }}>
                            {guide.links.map((link) => (
                              <Link
                                key={link.href}
                                href={link.href}
                                target={link.href.startsWith('mailto:') ? undefined : '_blank'}
                                rel="noopener noreferrer"
                                underline="hover"
                                sx={{ fontSize: 14, fontWeight: 600, py: 0.5 }}
                              >
                                {link.label}
                              </Link>
                            ))}
                          </Box>
                        )}
                      </AccordionDetails>
                    </Accordion>
                  ))}
                </Box>
              </AccordionDetails>
            </Accordion>
          ))}
        </Box>
      ) : (
        <Paper elevation={0} sx={{ p: { xs: 3, md: 5 }, textAlign: 'center', bgcolor: '#fff', border: '1px dashed #90caf9', borderRadius: 3 }}>
          <HelpOutlineIcon sx={{ fontSize: 42, color: '#90caf9', mb: 1 }} />
          <Typography variant="h6" sx={{ color: '#173b6c', fontWeight: 700 }}>
            Ничего не найдено
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
            Попробуйте изменить запрос или поискать по другому слову.
          </Typography>
        </Paper>
      )}
    </Box>
  );
};

export default Help;
