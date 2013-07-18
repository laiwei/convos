;(function($) {
  var $input, $messages, $win, chat_ws, current_target, history_offset;

  // same as id_as() helper in mojo
  var id_as = function(str) {
    return $.map(str.split(':00'), function(s, i) {
      return s.replace(/:(\w\w)/g, function(match, p1) {
        return String.fromCharCode(parseInt('0x' + p1, 16));
      });
    });
  };

  var getHistory = function() {
    if(!history_offset || $win.scrollTop() !== 0) return;
    $.get(location.href, { before: history_offset }, function(data) {
      var $data = $(data);
      if($data.children('li').length === 0) return;
      var height_before_prepend = $('body').height();
      $messages.prepend($data.children('li'));
      $win.scrollTop($('body').height() - height_before_prepend);
      history_offset = $data.attr('data-offset');
    });
    history_offset = 0;
  };

  var receiveMessage = function(e) {
    var $data = $(e.data);
    var cid_target = id_as($data.attr('data-target'));
    var cid_target_selector = targetToSelector($data.attr('data-target'));
    var channel = /^\#/.exec(cid_target[1]);
    var at_bottom = $win.data('at_bottom');
    var txt;

    if($data.hasClass('add-conversation')) {
      return location.href = $.url_for(cid_target.join('/'));
    }
    if($data.hasClass('remove-conversation')) {
      $('div.conversation-list').trigger('reload');
    }
    if($data.hasClass('highlight')) {
      var sender = $data.attr('data-sender');
      var what = channel ? 'mentioned you in #' + channel[1] : 'sent you a message';
      window.notify([sender, what].join(' '), $data.find('.content').text(), '');
      $('div.notification-list').trigger('reload');
    }
    if($data.hasClass('topic')) {
      $('navbar a.current').attr('title', $data.find('span:eq(1)').text());
    }
    if($('#conversation_' + cid_target_selector).length) {
      if($data.hasClass('remove-conversation')) {
        return location.href = $.url_for(cid_target.join('/'));
      }
      $messages.append($data.fadeIn('fast'));
    }
    if(at_bottom) {
      $win.scrollToBottom();
      $data.find('img').one('load', function() { $win.scrollToBottom() });
    }

    $input.removeClass('sending');
  };

  var drawUI = function() {
    var $conversation_list = $('div.conversation-list li').hide();
    var $conversation_list_button = $('nav a.conversation-list').hide();
    var available_width = $('nav').width() - $('nav .right').outerWidth() - $('nav a.settings').outerWidth();
    var used_width = 0;
    var left;

    $('nav .conversation-list a').each(function(i) {
      used_width += $(this).show().outerWidth();
      if(used_width < available_width) return;
      $conversation_list.eq(i).show();
      $(this).hide();
    });

    if(used_width >= available_width) {
      $conversation_list_button.show();
      left = $conversation_list_button.offset().left - 320 + 22;
      left = left < 6 ? 6 : left;
      $conversation_list.closest('div').css('left', left + 'px');
    }
    else {
      $conversation_list_button.trigger('toggle_hide');
    }

    if($win.data('at_bottom')) {
      $win.scrollToBottom();
    }
  };

  var sendMessage = function(message) {
    var $message = $('<div data-target="' + current_target + '"></div>').text(message);
    chat_ws.send($message.prop('outerHTML'));
    $input.addClass('sending');
  };

  var targetToSelector = function(target) {
    if(target === 'any') target = current_target;
    return target.replace(/:/g, '\\:');
  }

  $(document).ready(function() {
    $input = $('footer form input');
    $messages = $('.messages ul:first');
    $win = $(window);

    if($messages.length === 0) return; // not on chat page

    $('nav a.help').click(function(e) { sendMessage('/help'); $(document).click(); return false; })
    $input.closest('form').submit(function() { sendMessage($input.val()); $input.val(''); return false; });
    $win.on('scroll', getHistory).on('resize', drawUI);
    chat_ws = $.ws($.url_for('socket').replace(/^http/, 'ws'));
    chat_ws.on('message', receiveMessage);

    // TODO: Add shortcut for changing recent conversation-list
    $('body, input').bind('keydown', 'shift+return', function(e) {
      e.preventDefault();
      $win.scrollToBottom();
      $input.focus();
    });

    $('div.conversation-list').on('reload', function(e) {
      $.get($.url_for('conversations'), function(data) {
        $('ul.conversation-list').replaceWith(data);
        drawUI();
      });
    });

    $('div.notification-list').on('reload', function(e) {
      var $e = $(this);
      var $n_notifications = $('a.notification-list');
      var n;

      $.get($.url_for('notifications'), function(data) {
        $e.html(data);
        n = parseInt($e.children('ul').attr('data-notifications'), 10);
        $n_notifications.children('b').text(n);
        if($e.find('li').length) $n_notifications.removeClass('hidden');
        $n_notifications[n ? 'addClass' : 'removeClass']('alert');
      });
    });

    $(document).trigger('conversation_loaded');
  });

  $(document).on('conversation_loaded', function() {
    current_target = $messages.attr('id').replace(/^conversation_/, '');
    history_offset = parseFloat($messages.attr('data-offset') || 0);
    sendMessage('/topic');
  });

  $(document).on('completely_ready', function() {
    $win.focus(function() {
      if($win.data('at_bottom')) $input.focus();
    });

    if(location.href.indexOf('after=') === -1) {
      $input.focus();
      $win.data('at_bottom', true); // required before drawUI()
    }

    drawUI();
  });

})(jQuery);