'use strict';

import _ from 'lodash';
import React from 'react';
import TransitionGroup from "react-addons-css-transition-group";
import Message from 'components/Message';
import SendMessage from 'components/SendMessage';
import Dropzone from 'react-dropzone';
import MessageStore from 'stores/MessageStore';
import LoadingStateStore from 'stores/LoadingStateStore';
import UIActions from 'actions/UIActions';
import ChannelActions from 'actions/ChannelActions';
import Halogen from 'halogen';
import 'styles/Channel.scss';

class Channel extends React.Component {
  constructor(props) {
    super(props);
    console.log("Channel.constructor")

    this.state = {
      channelChanged: true,
      channelName: null,
      messages: [],
      loading: true,
      loadingText: 'Connecting...',
      reachedChannelStart: false,
      channelMode: "Public",
      error: null,
      dragEnter: false,
      username: props.user ? props.user.username : '',
      displayNewMessagesIcon: false,
      unreadMessages: 0,
      appSettings: props.appSettings,
      theme: props.theme
    };

    this.scrollTimer = null;
    this.topMargin = 120;
    this.bottomMargin = 20;
  }

  componentWillReceiveProps(nextProps) {
    console.log("Channel.componentWillReceiveProps", nextProps, this.state.channelName)
    if(nextProps.channel !== this.state.channelName) {
      console.log("new channel")
      this.setState({
        channelChanged: true,
        displayNewMessagesIcon: false,
        reachedChannelStart: false,
        messages: []
      });
      UIActions.focusOnSendMessage();
      // ChannelActions.loadMoreMessages(nextProps.channel);
      // this._getMessages(nextProps.channel);

      this._onLoadStateChange(nextProps.channel, LoadingStateStore.queue);
      // const loadingState = LoadingStateStore.queue[nextProps.channel];
      // console.log("loadingState", LoadingStateStore.queue, nextProps.channel)
      // const loading = loadingState ? Object.keys(loadingState).filter((f) => loadingState[f] && loadingState[f].loading) : [];
      // this.setState({ loading: loading.length > 0 })

      ChannelActions.loadMessages(nextProps.channel);
    }

    this.setState({
      channelName: nextProps.channel,
      username: nextProps.user ? nextProps.user.username : '',
      appSettings: nextProps.appSettings,
      theme: nextProps.theme
    });

    // console.log("channel._getMessages")
    // this._getMessages(nextProps.channel);
  }

  componentDidMount() {
    this.unsubscribeFromMessageStore = MessageStore.listen(this.onNewMessages.bind(this));
    console.log("Channel.componentDidMount")
    this.stopListeningLoadingState = LoadingStateStore.listen((state) => this._onLoadStateChange(this.state.channelName, state));
    this.stopListeningChannelState = ChannelActions.reachedChannelStart.listen(this._onReachedChannelStart.bind(this));
    this.unsubscribeFromErrors = UIActions.raiseError.listen(this._onError.bind(this));
    this.node = this.refs.MessagesView;

    // const loadingState = LoadingStateStore.queue[this.state.channelName];
    // console.log("loadingState", LoadingStateStore.queue, this.state.channelName)
    // const loading = loadingState ? Object.keys(loadingState).filter((f) => loadingState[f] && loadingState[f].loading) : [];
    // this.setState({ loading: loading.length > 0 })

    // ChannelActions.loadMoreMessages(this.state.channelName);
    // this._getMessages(this.state.channelName);
    // this.loadOlderMessages();
    // ChannelActions.loadMessages(this.state.channelName);
  }

  // _getMessages(channel) {
  //   const messages = MessageStore.getMessages(channel);
  //   this.setState({ messages: messages });
  // }

  _onLoadStateChange(channel, state) {
    const loadingState = state[channel];
    console.log("LOAD STATE", channel, state)
    if(loadingState) {
      const loading = Object.keys(loadingState).filter((f) => loadingState[f] && loadingState[f].loading);
      const loadingText = loadingState[loading[0]] ? loadingState[loading[0]].message : null;
      this.setState({ loading: loading.length > 0, loadingText: loadingText });
    } else {
      this.setState({ loading: false, loadingText: "" });
    }
  }

  _onError(errorMessage) {
    console.error("Channel:", errorMessage);
    this.setState({ error: errorMessage });
  }

  _onReachedChannelStart() {
    this.setState({ reachedChannelStart: true });
  }

  componentWillUnmount() {
    clearTimeout(this.scrollTimer);
    this.unsubscribeFromMessageStore();
    this.unsubscribeFromErrors();
    this.stopListeningLoadingState();
    this.stopListeningChannelState();
    this.setState({ messages: [] });
  }

  onNewMessages(channel: string, messages) {
    console.log("add messages", messages)
    if(channel !== this.state.channelName)
      return;

    this.node = this.refs.MessagesView;
    if(this.node.scrollHeight - this.node.scrollTop + this.bottomMargin > this.node.clientHeight
      && this.node.scrollHeight > this.node.clientHeight + 1
      && this.state.messages.length > 0 && _.last(messages).payload.meta.ts > _.last(this.state.messages).payload.meta.ts
      && this.node.scrollHeight > 0) {
      this.setState({
        displayNewMessagesIcon: true,
        unreadMessages: this.state.unreadMessages + 1
      });
    }

    this.setState({ messages: messages });
  }

  sendMessage(text: string) {
    if(text !== '')
      ChannelActions.sendMessage(this.state.channelName, text);
  }

  sendFile(filePath: string) {
    if(filePath !== '')
      ChannelActions.addFile(this.state.channelName, filePath);
  }

  loadOlderMessages() {
    if(!this.state.loading) {
      console.log("loadOlderMessages")
      ChannelActions.loadMoreMessages(this.state.channelName);
    }
  }

  componentWillUpdate() {
    this.node = this.refs.MessagesView;
    this.scrollTop = this.node.scrollTop;
    this.scrollHeight = this.node.scrollHeight;
  }

  componentDidUpdate() {
    this.node = this.refs.MessagesView;
    this.scrollAmount = this.node.scrollHeight - this.scrollHeight;
    this.keepScrollPosition = (this.scrollAmount > 0 && this.scrollTop > (0 + this.topMargin)) || this.state.reachedChannelStart;
    this.shouldScrollToBottom = (this.node.scrollTop + this.node.clientHeight + this.bottomMargin) >= this.scrollHeight;

    if(!this.keepScrollPosition)
      this.node.scrollTop += this.scrollAmount;

    if(this.shouldScrollToBottom)
      this.node.scrollTop = this.node.scrollHeight + this.node.clientHeight;

    // If the channel was changed, scroll to bottom to avoid weird positioning
    // TODO: replace with remembering each channel's scroll position on channel change
    if(this.state.channelChanged) {
      this.onScrollToBottom();
      this.setState({ channelChanged: false });
    }

    if(this._shouldLoadMoreMessages()) {
      console.log("1")
      this.loadOlderMessages();
    }
  }

  _shouldLoadMoreMessages() {
    return this.node && (this.node.scrollTop - this.topMargin <= 0 || this.node.scrollHeight === this.node.clientHeight);
  }

  onDrop(files) {
    this.setState({ dragEnter: false });
    console.log('Dropped files: ', files);
    files.forEach((file) => {
      if(file.path)
        this.sendFile(file.path);
      else
        console.error("File upload not yet implemented in browser. Try the electron app.");
    });
    UIActions.focusOnSendMessage();
  }

  onDragEnter() {
    this.setState({ dragEnter: true });
  }

  onDragLeave() {
    this.setState({ dragEnter: false });
  }

  onScroll() {
    if(this.scrollTimer)
      clearTimeout(this.scrollTimer);

    // After scroll has finished, check if we should load more messages
    // Using timeout here because of OS-applied scroll inertia
    this.scrollTimer = setTimeout(() => {
      if(this._shouldLoadMoreMessages())
        this.loadOlderMessages();
    }, 800);

    // If we scrolled to the bottom, hide the "new messages" label
    this.node = this.refs.MessagesView;
    if(this.node.scrollHeight - this.node.scrollTop - 10 <= this.node.clientHeight) {
      this.setState({ displayNewMessagesIcon: false, unreadMessages: 0 });
    }
  }

  onScrollToBottom() {
    UIActions.focusOnSendMessage();
    this.node.scrollTop = this.node.scrollHeight + this.node.clientHeight;
  }

  render() {
    const theme = this.state.theme;
    const channelMode = (<div className={"statusMessage"} style={theme}>{this.state.channelMode}</div>);

    const controlsBar = (
      <TransitionGroup
        component="div"
        transitionName="controlsAnimation"
        transitionAppear={true}
        transitionAppearTimeout={1000}
        transitionEnterTimeout={0}
        transitionLeaveTimeout={0}
        >
        <div className="Controls" key="controls">
          <SendMessage onSendMessage={this.sendMessage.bind(this)} key="SendMessage" theme={theme}/>
          <Dropzone className="dropzone2" onDrop={this.onDrop.bind(this)} key="dropzone2">
            <div className="icon flaticon-tool490" style={theme} key="icon"/>
          </Dropzone>
        </div>
      </TransitionGroup>
    );

    const messages = this.state.messages.map((e) => {
      return <Message
                message={e.payload}
                key={e.hash}
                onDragEnter={this.onDragEnter.bind(this)}
                highlightWords={this.state.username}
                colorifyUsername={this.state.appSettings.colorifyUsernames}
                useEmojis={this.state.appSettings.useEmojis}
              />;
    });

    let channelStateText = this.state.loading && this.state.loadingText ? this.state.loadingText : `Loading messages...`;
    if(this.state.reachedChannelStart)
      channelStateText = `Beginning of # ${this.state.channelName}`;

    messages.unshift(<div className="firstMessage" key="firstMessage" onClick={this.loadOlderMessages.bind(this)}>{channelStateText}</div>);

    const fileDrop = this.state.dragEnter ? (
      <Dropzone
        className="dropzone"
        activeClassName="dropzoneActive"
        disableClick={true}
        onDrop={this.onDrop.bind(this)}
        onDragEnter={this.onDragEnter.bind(this)}
        onDragLeave={this.onDragLeave.bind(this)}
        style={theme}
        key="dropzone"
        >
        <div ref="dropLabel" style={theme}>Add files to #{this.state.channelName}</div>
      </Dropzone>
    ) : "";

    const showNewMessageNotification = this.state.displayNewMessagesIcon ? (
      <div className="newMessagesBar" onClick={this.onScrollToBottom.bind(this)}>
        There are <span className="newMessagesNumber">{this.state.unreadMessages}</span> new messages
      </div>
    ) : (<span></span>);

    const loadingIcon = this.state.loading ? (
      <div className="loadingBar">
        <Halogen.MoonLoader className="loadingIcon" color="rgba(255, 255, 255, 0.7)" size="16px"/>
      </div>
    ) : "";

    return (
      <div className="Channel flipped" onDragEnter={this.onDragEnter.bind(this)}>
        <div className="Messages" ref="MessagesView" onScroll={this.onScroll.bind(this)} >
          {messages}
        </div>
        {showNewMessageNotification}
        {controlsBar}
        {fileDrop}
        {loadingIcon}
        {channelMode}
      </div>
    );
  }

}

export default Channel;
