import React, {useEffect} from 'react';
import {StatusBar, StyleSheet, View} from 'react-native';
import Orientation from 'react-native-orientation-locker';
import {useKeepAwake} from '@sayem314/react-native-keep-awake';
import ZegoUIKitPrebuiltLiveStreaming, {
  HOST_DEFAULT_CONFIG,
} from '@zegocloud/zego-uikit-prebuilt-live-streaming-rn';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {RootStackParamList} from '../navigation/types';
import {
  ZEGO_APP_ID,
  ZEGO_APP_SIGN,
  ZEGO_LIVE_ROOM_ID,
} from '../config/zegoConfig';

type Props = NativeStackScreenProps<RootStackParamList, 'Live'>;

export default function LiveScreen({navigation, route}: Props) {
  const {userName, userID} = route.params;

  useKeepAwake();

  useEffect(() => {
    Orientation.lockToPortrait();
    return () => {
      Orientation.unlockAllOrientations();
    };
  }, []);

  return (
    <View style={styles.container}>
      <StatusBar hidden />
      <ZegoUIKitPrebuiltLiveStreaming
        appID={ZEGO_APP_ID}
        appSign={ZEGO_APP_SIGN}
        userID={userID}
        userName={userName}
        liveID={ZEGO_LIVE_ROOM_ID}
        config={{
          ...HOST_DEFAULT_CONFIG,
          onLeaveLiveStreaming: () => {
            navigation.replace('Login');
          },
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
});
