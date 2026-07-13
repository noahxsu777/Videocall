import React, {useState} from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {RootStackParamList} from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;

export default function LoginScreen({navigation}: Props) {
  const [userName, setUserName] = useState('');

  const canGoLive = userName.trim().length > 0;

  const goLive = () => {
    if (!canGoLive) {
      return;
    }
    const userID = `${userName.trim()}_${Date.now()}`;
    navigation.navigate('Live', {userName: userName.trim(), userID});
  };

  return (
    <View style={styles.container}>
      <StatusBar hidden />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.content}>
          <View style={styles.logoWrapper}>
            <View style={styles.logoCircle}>
              <Text style={styles.logoEmoji}>🔴</Text>
            </View>
            <Text style={styles.title}>LiveStream</Text>
            <Text style={styles.subtitle}>Transmite en vivo para el mundo</Text>
          </View>

          <View style={styles.form}>
            <Text style={styles.label}>Tu nombre de usuario</Text>
            <TextInput
              value={userName}
              onChangeText={setUserName}
              placeholder="Ej. Noah"
              placeholderTextColor="#8a8a9a"
              style={styles.input}
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={30}
              returnKeyType="done"
              onSubmitEditing={goLive}
            />

            <Pressable
              onPress={goLive}
              disabled={!canGoLive}
              style={({pressed}) => [
                styles.goLiveButton,
                !canGoLive && styles.goLiveButtonDisabled,
                pressed && canGoLive && styles.goLiveButtonPressed,
              ]}>
              <Text style={styles.goLiveText}>Transmitir</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const ACCENT = '#fe2c55';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0e0e14',
  },
  flex: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  logoWrapper: {
    alignItems: 'center',
    marginBottom: 56,
  },
  logoCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#1c1c26',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    borderWidth: 2,
    borderColor: ACCENT,
  },
  logoEmoji: {
    fontSize: 36,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: 0.5,
  },
  subtitle: {
    marginTop: 8,
    fontSize: 14,
    color: '#9a9aab',
  },
  form: {
    width: '100%',
  },
  label: {
    color: '#c7c7d1',
    fontSize: 13,
    marginBottom: 8,
    marginLeft: 4,
  },
  input: {
    height: 52,
    borderRadius: 14,
    backgroundColor: '#1c1c26',
    paddingHorizontal: 16,
    color: '#ffffff',
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#2a2a36',
  },
  goLiveButton: {
    height: 54,
    borderRadius: 27,
    backgroundColor: ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
    shadowColor: ACCENT,
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: {width: 0, height: 6},
    elevation: 6,
  },
  goLiveButtonPressed: {
    opacity: 0.85,
  },
  goLiveButtonDisabled: {
    backgroundColor: '#3a2530',
    shadowOpacity: 0,
    elevation: 0,
  },
  goLiveText: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
