$(function() {
    $('#example').click(function() {
        var tags = $(this).text();
        $('#tags').val(tags);

        return false;
    });
});
