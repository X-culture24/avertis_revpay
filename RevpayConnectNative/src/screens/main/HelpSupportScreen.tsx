import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Linking,
} from 'react-native';
import { colors } from '@/theme/theme';

interface FAQ {
  id: string;
  question: string;
  answer: string;
  category: string;
}

const HelpSupportScreen: React.FC = () => {
  const [expandedFAQ, setExpandedFAQ] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [supportMessage, setSupportMessage] = useState('');
  const [supportEmail, setSupportEmail] = useState('');

  const categories = [
    { id: 'all', name: 'All' },
    { id: 'getting-started', name: 'Getting Started' },
    { id: 'invoices', name: 'Invoices' },
    { id: 'devices', name: 'Devices' },
    { id: 'compliance', name: 'Compliance' },
    { id: 'billing', name: 'Billing' },
    { id: 'technical', name: 'Technical' },
  ];

  const faqs: FAQ[] = [
    {
      id: '1',
      question: 'How do I register my company with KRA eTIMS?',
      answer: 'Navigate to Dashboard > Company Setup > Register Company. Fill in your company details including TIN, business name, and contact information. Submit the form and wait for KRA approval, which typically takes 1-2 business days.',
      category: 'getting-started',
    },
    {
      id: '2',
      question: 'What is the difference between OSCU and VSCU modes?',
      answer: 'OSCU (Online Sales Control Unit) requires a physical device from KRA for invoice validation. VSCU (Virtual Sales Control Unit) is a software-based solution that doesn\'t require physical hardware. VSCU is recommended for most businesses starting out.',
      category: 'devices',
    },
    {
      id: '3',
      question: 'How do I create and submit an invoice?',
      answer: 'Go to Invoices > Create Invoice. Fill in customer details, add items with prices and tax rates. Review the invoice and tap Submit. The invoice will be automatically synced to KRA eTIMS if your device is configured.',
      category: 'invoices',
    },
    {
      id: '4',
      question: 'Why is my invoice sync failing?',
      answer: 'Common reasons include: 1) Device not properly configured, 2) Network connectivity issues, 3) Invalid customer PIN, 4) Incorrect tax calculations. Check the error message in the invoice details for specific guidance.',
      category: 'technical',
    },
    {
      id: '5',
      question: 'How do I upgrade my subscription plan?',
      answer: 'Go to Settings > Subscription. View available plans and tap "Upgrade" on your desired plan. Follow the payment instructions to complete the upgrade. Your new limits will be effective immediately.',
      category: 'billing',
    },
    {
      id: '6',
      question: 'What are compliance reports and how do I generate them?',
      answer: 'Compliance reports show your tax submission status and invoice statistics. Go to Reports tab and select the period you want to report on. You can export reports as PDF for your records or KRA audits.',
      category: 'compliance',
    },
    {
      id: '7',
      question: 'How do I add multiple devices?',
      answer: 'Go to Dashboard > Device Setup. You can add multiple OSCU or VSCU devices. Each device needs to be registered with KRA separately. SME and Corporate plans support multiple devices.',
      category: 'devices',
    },
    {
      id: '8',
      question: 'Can I export my invoice data?',
      answer: 'Yes, go to Reports > Export Data. You can export invoices, customer data, and compliance reports in CSV or PDF format. This feature is available on SME and Corporate plans.',
      category: 'invoices',
    },
    {
      id: '9',
      question: 'How do I reset my password?',
      answer: 'On the login screen, tap "Forgot Password". Enter your registered email address. You\'ll receive a password reset link via email. Follow the link to set a new password.',
      category: 'getting-started',
    },
    {
      id: '10',
      question: 'What should I do if I receive a KRA audit notice?',
      answer: 'Generate a comprehensive compliance report from the Reports section. Export all relevant invoices and transaction data. Contact our support team for assistance in preparing audit documentation.',
      category: 'compliance',
    },
  ];

  const filteredFAQs = faqs.filter(faq => {
    const matchesCategory = selectedCategory === 'all' || faq.category === selectedCategory;
    const matchesSearch = faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         faq.answer.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const toggleFAQ = (id: string) => {
    setExpandedFAQ(expandedFAQ === id ? null : id);
  };

  const handleCall = () => {
    Linking.openURL('tel:+254700000000');
  };

  const handleEmail = () => {
    Linking.openURL('mailto:support@revpayconnect.com');
  };

  const handleWhatsApp = () => {
    Linking.openURL('https://wa.me/254700000000');
  };

  const handleSubmitTicket = () => {
    if (!supportEmail || !supportMessage) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    // TODO: Submit support ticket to API
    Alert.alert(
      'Ticket Submitted',
      'Your support ticket has been submitted. We\'ll get back to you within 24 hours.',
      [
        {
          text: 'OK',
          onPress: () => {
            setSupportEmail('');
            setSupportMessage('');
          },
        },
      ]
    );
  };

  const handleOpenDocumentation = () => {
    Linking.openURL('https://docs.revpayconnect.com');
  };

  const handleOpenVideoTutorials = () => {
    Linking.openURL('https://youtube.com/@revpayconnect');
  };

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Help & Support</Text>
        <Text style={styles.subtitle}>We're here to help you succeed</Text>
      </View>

      {/* Quick Contact */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Contact Us</Text>
        <View style={styles.contactGrid}>
          <TouchableOpacity style={styles.contactCard} onPress={handleCall}>
            <Text style={styles.contactIcon}>📞</Text>
            <Text style={styles.contactLabel}>Call Us</Text>
            <Text style={styles.contactValue}>+254 700 000 000</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.contactCard} onPress={handleEmail}>
            <Text style={styles.contactIcon}>✉️</Text>
            <Text style={styles.contactLabel}>Email</Text>
            <Text style={styles.contactValue}>support@revpay.com</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.contactCard} onPress={handleWhatsApp}>
            <Text style={styles.contactIcon}>💬</Text>
            <Text style={styles.contactLabel}>WhatsApp</Text>
            <Text style={styles.contactValue}>Chat Now</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Resources */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Resources</Text>
        <TouchableOpacity style={styles.resourceCard} onPress={handleOpenDocumentation}>
          <View style={styles.resourceContent}>
            <Text style={styles.resourceIcon}>📚</Text>
            <View style={styles.resourceText}>
              <Text style={styles.resourceTitle}>Documentation</Text>
              <Text style={styles.resourceDescription}>Complete guides and API references</Text>
            </View>
          </View>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.resourceCard} onPress={handleOpenVideoTutorials}>
          <View style={styles.resourceContent}>
            <Text style={styles.resourceIcon}>🎥</Text>
            <View style={styles.resourceText}>
              <Text style={styles.resourceTitle}>Video Tutorials</Text>
              <Text style={styles.resourceDescription}>Step-by-step video guides</Text>
            </View>
          </View>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>
      </View>

      {/* FAQs */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Frequently Asked Questions</Text>

        {/* Search */}
        <View style={styles.searchContainer}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search FAQs..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor={colors.textSecondary}
          />
        </View>

        {/* Categories */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoriesScroll}>
          {categories.map(category => (
            <TouchableOpacity
              key={category.id}
              style={[
                styles.categoryChip,
                selectedCategory === category.id && styles.categoryChipActive,
              ]}
              onPress={() => setSelectedCategory(category.id)}
            >
              <Text
                style={[
                  styles.categoryChipText,
                  selectedCategory === category.id && styles.categoryChipTextActive,
                ]}
              >
                {category.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* FAQ List */}
        {filteredFAQs.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🔍</Text>
            <Text style={styles.emptyText}>No FAQs found</Text>
            <Text style={styles.emptySubtext}>Try a different search or category</Text>
          </View>
        ) : (
          filteredFAQs.map(faq => (
            <TouchableOpacity
              key={faq.id}
              style={styles.faqCard}
              onPress={() => toggleFAQ(faq.id)}
            >
              <View style={styles.faqHeader}>
                <Text style={styles.faqQuestion}>{faq.question}</Text>
                <Text style={styles.faqToggle}>
                  {expandedFAQ === faq.id ? '−' : '+'}
                </Text>
              </View>
              {expandedFAQ === faq.id && (
                <Text style={styles.faqAnswer}>{faq.answer}</Text>
              )}
            </TouchableOpacity>
          ))
        )}
      </View>

      {/* Submit Ticket */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Submit a Support Ticket</Text>
        <View style={styles.ticketCard}>
          <Text style={styles.ticketDescription}>
            Can't find what you're looking for? Submit a ticket and our team will get back to you.
          </Text>

          <TextInput
            style={styles.input}
            placeholder="Your Email"
            value={supportEmail}
            onChangeText={setSupportEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            placeholderTextColor={colors.textSecondary}
          />

          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Describe your issue..."
            value={supportMessage}
            onChangeText={setSupportMessage}
            multiline
            numberOfLines={6}
            textAlignVertical="top"
            placeholderTextColor={colors.textSecondary}
          />

          <TouchableOpacity style={styles.submitButton} onPress={handleSubmitTicket}>
            <Text style={styles.submitButtonText}>Submit Ticket</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Support Hours */}
      <View style={styles.section}>
        <View style={styles.hoursCard}>
          <Text style={styles.hoursTitle}>Support Hours</Text>
          <View style={styles.hoursRow}>
            <Text style={styles.hoursLabel}>Monday - Friday:</Text>
            <Text style={styles.hoursValue}>8:00 AM - 6:00 PM EAT</Text>
          </View>
          <View style={styles.hoursRow}>
            <Text style={styles.hoursLabel}>Saturday:</Text>
            <Text style={styles.hoursValue}>9:00 AM - 1:00 PM EAT</Text>
          </View>
          <View style={styles.hoursRow}>
            <Text style={styles.hoursLabel}>Sunday:</Text>
            <Text style={styles.hoursValue}>Closed</Text>
          </View>
          <Text style={styles.hoursNote}>
            * Emergency support available 24/7 for Corporate plan subscribers
          </Text>
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    padding: 20,
    paddingTop: 60,
    backgroundColor: colors.primary,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 14,
    color: '#fff',
    opacity: 0.9,
  },
  section: {
    padding: 15,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 15,
  },
  contactGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  contactCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 15,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  contactIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  contactLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  contactValue: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.text,
    textAlign: 'center',
  },
  resourceCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 15,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  resourceContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  resourceIcon: {
    fontSize: 32,
    marginRight: 15,
  },
  resourceText: {
    flex: 1,
  },
  resourceTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  resourceDescription: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  chevron: {
    fontSize: 24,
    color: colors.textSecondary,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchIcon: {
    fontSize: 18,
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
  },
  categoriesScroll: {
    marginBottom: 15,
  },
  categoryChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: 8,
  },
  categoryChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  categoryChipText: {
    fontSize: 13,
    color: colors.text,
    fontWeight: '500',
  },
  categoryChipTextActive: {
    color: '#fff',
  },
  faqCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 15,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  faqHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  faqQuestion: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
    flex: 1,
    marginRight: 10,
  },
  faqToggle: {
    fontSize: 24,
    color: colors.primary,
    fontWeight: 'bold',
  },
  faqAnswer: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 10,
    lineHeight: 20,
  },
  emptyState: {
    alignItems: 'center',
    padding: 40,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 10,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 5,
  },
  emptySubtext: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  ticketCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  ticketDescription: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 20,
    lineHeight: 20,
  },
  input: {
    backgroundColor: colors.background,
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 15,
  },
  textArea: {
    height: 120,
    paddingTop: 12,
  },
  submitButton: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    padding: 15,
    alignItems: 'center',
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  hoursCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  hoursTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 15,
  },
  hoursRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  hoursLabel: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  hoursValue: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  hoursNote: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 15,
    fontStyle: 'italic',
  },
});

export default HelpSupportScreen;
