/**
 * @format
 */

import React from 'react';
import {StatusBar} from 'react-native';
import {NavigationContainer, DarkTheme} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import LoginScreen from './src/screens/LoginScreen';
import LiveScreen from './src/screens/LiveScreen';
import type {RootStackParamList} from './src/navigation/types';

const Stack = createNativeStackNavigator<RootStackParamList>();

function App(): React.JSX.Element {
  return (
    <SafeAreaProvider>
      <StatusBar hidden />
      <NavigationContainer theme={DarkTheme}>
        <Stack.Navigator
          initialRouteName="Login"
          screenOptions={{
            headerShown: false,
            animation: 'fade',
            contentStyle: {backgroundColor: '#0e0e14'},
          }}>
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Live" component={LiveScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

export default App;
