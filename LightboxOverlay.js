/**
 * @providesModule LightboxOverlay
 */
'use strict';
global.headerclose = null; //resolve headerclose crash

import React, { Component, PropTypes }  from 'react';
import {
  Animated,
  Dimensions,
  Modal,
  PanResponder,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

var WINDOW_HEIGHT = Dimensions.get('window').height;
var WINDOW_WIDTH = Dimensions.get('window').width;
var DRAG_DISMISS_THRESHOLD = 150;
var STATUS_BAR_OFFSET = (Platform.OS === 'android' ? -25 : 0);

var LightboxOverlay = React.createClass({
  propTypes: {
    origin: PropTypes.shape({
      x:        PropTypes.number,
      y:        PropTypes.number,
      width:    PropTypes.number,
      height:   PropTypes.number,
    }),
    springConfig: PropTypes.shape({
      tension:  PropTypes.number,
      friction: PropTypes.number,
    }),
    backgroundColor: PropTypes.string,
    isOpen:          PropTypes.bool,
    renderHeader:    PropTypes.func,
    renderFooter:    PropTypes.object,
    onClose:         PropTypes.func,
    isPanning:  PropTypes.func,
    isPanningEnd:  PropTypes.func,
    onPanRelease: PropTypes.func,
    isAnimating:  PropTypes.func,
    isAnimatingEnd:  PropTypes.func,
    beforeClose:  PropTypes.func,
    swipeToDismiss:  PropTypes.bool,
  },

  getInitialState: function() {
    return {
      isAnimating: false,
      isPanning: false,
      target: {
        x: 0,
        y: 0,
        opacity: 1,
      },
      isClosed: false,
      panningCbFired: false,
      pan: new Animated.Value(0),
      openVal: new Animated.Value(0),
      hideUi: false,
    };
  },

  getDefaultProps: function() {
    return {
      springConfig: { tension: 30, friction: 7 },
      backgroundColor: 'black',
    };
  },

  _initialTouchX: 0,
  _initialTouchY: 0,
  componentWillMount: function() {
    this._panResponder = PanResponder.create({
      // Ask to be the responder:
      onStartShouldSetPanResponder: (evt, gestureState) => !this.state.isAnimating,
      onStartShouldSetPanResponderCapture: (evt, gestureState) => !this.state.isAnimating,
      onMoveShouldSetPanResponder: (evt, gestureState) => !this.state.isAnimating,
      onMoveShouldSetPanResponderCapture: (evt, gestureState) => !this.state.isAnimating,
      onPanResponderGrant: (evt, gestureState) => {
        this._pageX = evt.nativeEvent.pageX;
        this._pageY = evt.nativeEvent.pageY;
        this.state.pan.setValue(0);
      },
      onPanResponderMove: (evt, { dx, dy, x0, y0 }) => {
        this.setState({ isPanning: true });
        if (!this.state.panningCbFired) {
          this.setState({
            panningCbFired: true,
            hideUi: true
          }, this.props.isPanning)
        } else if (!this.state.hideUi){
          this.setState({
            hideUi: true
          })
        }
        this.state.pan.setValue(dy)
      },
      onPanResponderRelease: (evt, gestureState) => {
        this.props.onPanRelease()
        if(Math.abs(gestureState.dy) > DRAG_DISMISS_THRESHOLD) {
          this.setState({
            isPanning: false,
            panningCbFired: false,
            hideUi: false,
            target: {
              y: gestureState.dy,
              x: gestureState.dx,
              opacity: 1 - Math.abs(gestureState.dy / WINDOW_HEIGHT)
            }
          }, this.props.isPanningEnd);
          this.close();
        } else {
          if(this._pageX === evt.nativeEvent.pageX && this._pageY === evt.nativeEvent.pageY) {
            this.props.onPress();
            this.setState({
              panningCbFired: false,
              hideUi: !this.state.hideUi
            });
          } else {
            this.setState({
              panningCbFired: false,
              hideUi: false
            });
          }

          Animated.spring(this.state.pan, {
            toValue: 0,
            ...this.props.springConfig
          }).start(() => {
            this.setState({
              isPanning: false
            }, this.props.isPanningEnd)
          });
        }
      },
    });
  },

  componentDidMount: function() {
    headerclose = this;
    if(this.props.isOpen) {
      this.open();
    }
  },

  open: function() {
    StatusBar.setHidden(true, 'fade');
    this.state.pan.setValue(0);
    this.setState({
      isAnimating: true,
      target: {
        x: 0,
        y: 0,
        opacity: 1,
      },
      isClosed: false,
    }, this.props.isAnimating);

    Animated.spring(
      this.state.openVal,
      { toValue: 1, ...this.props.springConfig }
    ).start(() => this.setState({ isAnimating: false }, this.props.isAnimatingEnd));
  },

  close: function() {
    StatusBar.setHidden(false, 'fade');
    this.props.beforeClose();
    this.setState({
      isAnimating: true,
      isClosed: true
    }, this.props.isAnimating);
    // this.state.openVal.setValue(0);
    // this.props.onClose();

    Animated.spring(
      this.state.openVal,
      { toValue: 0, ...this.props.springConfig }
    ).start(() => {
      this.setState({
        isAnimating: false,
      }, this.props.isAnimatingEnd);
      this.props.onClose();
    });
  },

  componentWillReceiveProps: function(props) {
    if(this.props.isOpen != props.isOpen && props.isOpen) {
      this.open();
    }
  },

  render: function() {
    var {
      isOpen,
      renderHeader,
      renderFooter,
      swipeToDismiss,
      origin,
      backgroundColor
    } = this.props;

    if(typeof this.props.origin === 'undefined') {
      throw new Error('If you passed a navigator check to add props to the component in your `renderScene` function');
    }

    var {
      isPanning,
      isAnimating,
      openVal,
      target,
    } = this.state;


    var lightboxOpacityStyle = {
      opacity: openVal.interpolate({inputRange: [0, 1], outputRange: [0, target.opacity]})
    };

    var handlers;
    if(swipeToDismiss) {
      handlers = this._panResponder.panHandlers;
    }

    var dragStyle;
    if(isPanning) {
      dragStyle = {
        top: this.state.pan,
      };
      lightboxOpacityStyle.opacity = this.state.pan.interpolate({inputRange: [-WINDOW_HEIGHT, 0, WINDOW_HEIGHT], outputRange: [0, 1, 0]});
    }

    let h = (this.state.isClosed) ? 0 : WINDOW_HEIGHT;
    var openStyle = [styles.open, {
      left:   openVal.interpolate({inputRange: [0, 1], outputRange: [origin.x, target.x]}),
      top:    openVal.interpolate({inputRange: [0, 1], outputRange: [origin.y + STATUS_BAR_OFFSET, target.y + STATUS_BAR_OFFSET]}),
      width:  openVal.interpolate({inputRange: [0, 1], outputRange: [origin.width, WINDOW_WIDTH]}),
      height: openVal.interpolate({inputRange: [0, 1], outputRange: [origin.height, WINDOW_HEIGHT]}),
    }];

    var background = (<Animated.View style={[styles.background, { backgroundColor: backgroundColor }, lightboxOpacityStyle]}></Animated.View>);
    var header = (<Animated.View style={[styles.header, this.state.hideUi ? {opacity: 0} : lightboxOpacityStyle]}>{(renderHeader ?
      () => renderHeader(this.close) :
      (
        <TouchableOpacity onPress={this.close}>
          <Text style={styles.closeButton}>×</Text>
        </TouchableOpacity>
      )
    )}</Animated.View>);

    var footer = null
    if(renderFooter) {
      footer = (
        <Animated.View style={[styles.footer, this.state.hideUi ? {opacity: 0} : lightboxOpacityStyle]}>
          {renderFooter}
        </Animated.View>
      )
    }

    var content = (
      <Animated.View style={[openStyle, dragStyle]} {...handlers}>
        {this.props.children}
      </Animated.View>
    );
    if(this.props.navigator) {
      return (
        <View>
          {background}
          {content}
          {header}
          {footer}
        </View>
      );
    }

    return (
      <Modal onRequestClose={() => {/*Required for android*/}} visible={isOpen} transparent={true}>
        {background}
        {content}
        {header}
        {footer}
      </Modal>
    );
  }
});

var styles = StyleSheet.create({
  background: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: WINDOW_WIDTH,
    height: WINDOW_HEIGHT,
  },
  open: {
    position: 'absolute',
    flex: 1,
    justifyContent: 'center',
    // Android pan handlers crash without this declaration:
    backgroundColor: 'transparent',
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: WINDOW_WIDTH,
    backgroundColor: 'transparent',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    width: WINDOW_WIDTH,
    backgroundColor: 'transparent'
  },
  closeButton: {
    fontSize: 35,
    color: 'white',
    lineHeight: 40,
    width: 40,
    textAlign: 'center',
    shadowOffset: {
      width: 0,
      height: 0,
    },
    shadowRadius: 1.5,
    shadowColor: 'black',
    shadowOpacity: 0.8,
  },
});

module.exports = LightboxOverlay;
